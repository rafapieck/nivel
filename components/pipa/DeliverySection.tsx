"use client";

import { useEffect, useState } from "react";
import { Field, Notice, card, inputCls, primaryBtn, secondaryBtn } from "@/components/ui";
import { fmtDateTime, fmtEventRange, fmtInt } from "@/lib/format";
import { getAllReadings, listCalibrations } from "@/lib/db";
import {
  errorMessage,
  raiseDiscrepancy,
  recordDelivery,
  resolveDiscrepancy,
  setOrderStatus,
  shareSummary,
  type Delivery,
  type Discrepancy,
  type TankSummaryRow,
} from "@/lib/pipa";
import { deliveryInput, discrepancyText, toNumber } from "@/lib/pipaSchemas";
import {
  GAP_TOLERANCE,
  buildTankSummary,
  quotedObservedGap,
  tankSummaryPayload,
  type SummaryResult,
} from "@/lib/summary";
import { buildTankData, type TankData } from "@/lib/tank";
import type { PipaCtx } from "@/lib/usePipa";
import type { OrderData } from "./OrderView";

export type DeliveryData = {
  delivery: Delivery | null;
  summaries: TankSummaryRow[];
  discrepancies: Discrepancy[];
};

type Props = { data: OrderData; dd: DeliveryData; ctx: PipaCtx; reload: () => void };

/** Local tank data from IndexedDB (never uploaded); null when no tank is declared here. */
function useLocalTank() {
  const [tank, setTank] = useState<TankData | null | undefined>(undefined);
  useEffect(() => {
    Promise.all([listCalibrations(), getAllReadings()]).then(([c, r]) => setTank(buildTankData(c, r)));
  }, []);
  return tank;
}

function toLocalInput(ts: number) {
  return new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function DeliverySection(props: Props) {
  const { data, dd } = props;
  if (!dd.delivery) {
    return data.isCoordinator ? (
      <RecordDeliveryForm {...props} />
    ) : (
      <section className={card}>
        <h2 className="text-xl font-bold">Entrega</h2>
        <p className="text-base text-slate-600">Quien coordina registrará la entrega cuando llegue la pipa.</p>
      </section>
    );
  }
  return <DeliveryView {...props} delivery={dd.delivery} />;
}

function RecordDeliveryForm({ data, ctx, reload }: Props) {
  const tank = useLocalTank();
  const [when, setWhen] = useState(() => toLocalInput(Date.now()));
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastEvent = tank?.analysis.events.at(-1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = deliveryInput.safeParse({
      deliveredAt: new Date(when).getTime(),
      fillMinutes: toNumber(minutes),
      notes,
    });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) out[String(i.path[0])] ??= i.message;
      return setErrors(out);
    }
    setErrors({});
    setBusy(true);
    try {
      await recordDelivery(ctx.sb, data.order.id, {
        deliveredAt: new Date(parsed.data.deliveredAt).toISOString(),
        fillMinutes: parsed.data.fillMinutes,
        notes: parsed.data.notes || null,
      });
      reload();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card} noValidate>
      <h2 className="text-xl font-bold">Registrar entrega</h2>
      {lastEvent && (
        <button
          type="button"
          onClick={() => {
            setWhen(toLocalInput(lastEvent.start));
            setMinutes(String(Math.round((lastEvent.end - lastEvent.start) / 60000)));
          }}
          className={secondaryBtn}
        >
          Usar la última entrada de agua de mi tinaco ({fmtEventRange(lastEvent.start, lastEvent.end)})
        </button>
      )}
      <Field id="d-when" label="¿Cuándo empezó a llenar?" error={errors.deliveredAt}>
        <input id="d-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
      </Field>
      <Field id="d-min" label="¿Cuántos minutos tardó?" unit="min" error={errors.fillMinutes}>
        <input id="d-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={!!errors.fillMinutes} className={inputCls} />
      </Field>
      <Field id="d-notes" label="Notas (opcional)" error={errors.notes}>
        <textarea id="d-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} className={`${inputCls} py-2 text-lg`} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? "Guardando…" : "Guardar entrega"}
      </button>
    </form>
  );
}

function DeliveryView({ data, dd, ctx, reload, delivery }: Props & { delivery: Delivery }) {
  const { order, group, me, isCoordinator } = data;
  const cistern = group.delivery_mode === "cistern";
  const gap = quotedObservedGap(delivery.quoted_liters, delivery.observed_liters);
  const tankWord = cistern ? "cisterna" : delivery.observed_tanks_total === 1 ? "tinaco" : "tinacos";

  return (
    <div className="space-y-4">
      <section className={card} aria-labelledby="entrega">
        <h2 id="entrega" className="text-xl font-bold">
          Entrega
        </h2>
        <p className="text-base text-slate-700">
          {fmtDateTime(Date.parse(delivery.delivered_at))} · llenado de {delivery.fill_minutes} min
        </p>
        {delivery.notes && <p className="text-base text-slate-600">{delivery.notes}</p>}

        <dl className="grid grid-cols-3 gap-1 text-center">
          <div className="rounded-xl bg-slate-50 px-1 py-2">
            <dt className="text-sm font-semibold text-slate-600">Cotizados</dt>
            <dd className="whitespace-nowrap text-lg font-bold">{fmtInt(delivery.quoted_liters)} L</dd>
            <dd className="text-sm text-slate-600">del proveedor</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-1 py-2">
            <dt className="text-sm font-semibold text-slate-600">Observados</dt>
            {delivery.observed_liters !== null ? (
              <>
                <dd className="whitespace-nowrap text-lg font-bold">{fmtInt(delivery.observed_liters)} L</dd>
                <dd className="text-sm text-slate-600">
                  {delivery.observed_tanks_reported} de {delivery.observed_tanks_total} {tankWord} reportaron
                </dd>
              </>
            ) : (
              <dd className="text-base font-semibold leading-tight text-slate-700">no observado</dd>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 px-1 py-2">
            <dt className="text-sm font-semibold text-slate-600">Estimados</dt>
            {delivery.estimated_liters !== null ? (
              <dd className="whitespace-nowrap text-lg font-bold">{fmtInt(delivery.estimated_liters)} L</dd>
            ) : (
              <dd className="text-lg font-semibold text-slate-700">—</dd>
            )}
            <dd className="mt-1">
              <span className="inline-block rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-semibold leading-tight text-slate-800">
                Estimación (ML)
              </span>
            </dd>
          </div>
        </dl>
        <p className="text-base font-medium text-slate-800">Las lecturas del tinaco no son prueba de volumen.</p>
        <p className="text-sm text-slate-600">
          Observados = suma de los resúmenes que cada hogar decidió compartir.{" "}
          {cistern
            ? "En cisterna compartida solo cuenta la cisterna: los tinacos se llenan con bomba."
            : "Estimados = observados más el agua que se siguió usando durante el llenado."}
        </p>
        <p className="text-base text-slate-700">
          Entrega para: {group.nivel_group_members.map((m) => m.display_name).join(", ")}
        </p>
      </section>

      {me && order.status !== "closed" && !dd.summaries.some((s) => s.member_id === me.id) && (
        <MySummary data={data} ctx={ctx} delivery={delivery} reload={reload} />
      )}
      {me && dd.summaries.some((s) => s.member_id === me.id) && (
        <Notice tone="ok">Compartiste el resumen de tu tinaco para esta pipa.</Notice>
      )}

      <Discrepancies data={data} dd={dd} ctx={ctx} reload={reload} delivery={delivery} gap={gap} />

      {isCoordinator && order.status === "delivered" && (
        <section className={card}>
          <p className="text-base text-slate-600">
            Puedes cerrar el pedido aunque haya pagos pendientes: el pago nunca bloquea la entrega.
          </p>
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => setOrderStatus(ctx.sb, order.id, "closed").then(reload)}
          >
            Cerrar pedido
          </button>
        </section>
      )}
    </div>
  );
}

const DECLINED_KEY = (orderId: string) => `nivel-summary-declined-${orderId}`;

function readDeclined(orderId: string) {
  try {
    return localStorage.getItem(DECLINED_KEY(orderId)) === "1";
  } catch {
    return false;
  }
}

/** Built on this phone. Nothing leaves it unless the owner taps "Compartir resumen". */
function MySummary({
  data,
  ctx,
  delivery,
  reload,
}: {
  data: OrderData;
  ctx: PipaCtx;
  delivery: Delivery;
  reload: () => void;
}) {
  const tank = useLocalTank();
  const [declined, setDeclined] = useState(() => readDeclined(data.order.id));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (tank === undefined) return null;
  if (declined) {
    return (
      <section className={card}>
        <p className="text-base text-slate-700">
          Elegiste no compartir el resumen de tu tinaco. No salió nada de este teléfono.
        </p>
        <button
          type="button"
          className={secondaryBtn}
          onClick={() => {
            try {
              localStorage.removeItem(DECLINED_KEY(data.order.id));
            } catch {}
            setDeclined(false);
          }}
        >
          Ver el resumen otra vez
        </button>
      </section>
    );
  }
  if (tank === null) {
    return (
      <section className={card}>
        <p className="text-base text-slate-600">
          No hay un tinaco declarado en este teléfono, así que no hay resumen que compartir.
        </p>
      </section>
    );
  }

  const a = tank.analysis;
  const rate = a.lead === "ml" ? (a.ml?.litersPerDay ?? null) : a.baseline;
  const result: SummaryResult = buildTankSummary(
    tank.samples,
    tank.cal,
    Date.parse(delivery.delivered_at),
    delivery.fill_minutes,
    rate,
  );

  if (!result.ok) {
    return (
      <section className={card}>
        <h2 className="text-xl font-bold">Resumen de tu tinaco</h2>
        <p className="text-base text-slate-600">
          {result.reason === "no_before"
            ? "No hay lecturas de tu tinaco en las 3 horas antes de la entrega."
            : "No hay lecturas de tu tinaco en las 3 horas después del llenado."}
        </p>
      </section>
    );
  }

  const d = result.draft;
  async function share() {
    if (!data.me) return;
    const parsed = tankSummaryPayload.safeParse({ ...d, order_id: data.order.id, member_id: data.me.id });
    if (!parsed.success) return setError("El resumen no pasó la validación; no se envió.");
    setBusy(true);
    try {
      await shareSummary(ctx.sb, parsed.data);
      reload();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function decline() {
    try {
      localStorage.setItem(DECLINED_KEY(data.order.id), "1");
    } catch {}
    setDeclined(true);
  }

  return (
    <section className={card} aria-labelledby="resumen-tinaco">
      <h2 id="resumen-tinaco" className="text-xl font-bold">
        Resumen de tu {d.tank_type === "cisterna" ? "cisterna" : "tinaco"} para esta pipa
      </h2>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-sm text-slate-600">Antes</dt>
          <dd className="text-lg font-bold">{fmtInt(d.before_l)} L</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Después</dt>
          <dd className="text-lg font-bold">{fmtInt(d.after_l)} L</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Subió</dt>
          <dd className="text-lg font-bold">{d.delta_l >= 0 ? "+" : ""}{fmtInt(d.delta_l)} L</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-600">
        Calibración: {fmtInt(d.calibration_snapshot.capacity_l)} L, {d.calibration_snapshot.d_full_cm}–
        {d.calibration_snapshot.d_empty_cm} cm, del {fmtDateTime(Date.parse(d.calibration_snapshot.calibrated_at))}.
      </p>
      <p className="text-sm text-slate-600">{d.concurrent_use_note}</p>
      {tank.sources.has("simulated") && (
        <p className="rounded-lg bg-yellow-300 px-3 py-2 text-center text-base font-bold text-yellow-950">FEED SIMULADO</p>
      )}
      <p className="text-base text-slate-700">
        Solo se comparte esto: antes, después, cuánto subió y la calibración. Tus lecturas no se
        comparten.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={decline} className={secondaryBtn}>
          No compartir
        </button>
        <button type="button" onClick={share} disabled={busy} className={primaryBtn}>
          Compartir resumen
        </button>
      </div>
    </section>
  );
}

function Discrepancies({
  data,
  dd,
  ctx,
  reload,
  delivery,
  gap,
}: Props & { delivery: Delivery; gap: number | null }) {
  const [text, setText] = useState("");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bigGap = gap !== null && Math.abs(gap) > GAP_TOLERANCE;
  const mine = dd.discrepancies;

  async function open(e: React.FormEvent) {
    e.preventDefault();
    const parsed = discrepancyText.safeParse(text);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    try {
      await raiseDiscrepancy(ctx.sb, data.order.id, ctx.session.user.id, parsed.data);
      setOpening(false);
      setError(null);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!bigGap && mine.length === 0) return null;

  return (
    <section className={card} aria-labelledby="aclaraciones">
      <h2 id="aclaraciones" className="text-xl font-bold">
        Aclaraciones
      </h2>
      {bigGap && (
        <p className="text-base text-slate-700">
          Hay {Math.round(Math.abs(gap!) * 100)}% de diferencia entre los litros cotizados y los
          observados. Puede haber muchas razones; quien coordina lo revisa.
        </p>
      )}
      {mine.map((d) => (
        <DiscrepancyItem key={d.id} d={d} ctx={ctx} canResolve={data.isCoordinator} reload={reload} />
      ))}
      {bigGap && data.me && !opening && (
        <button
          type="button"
          className={primaryBtn}
          onClick={() => {
            setText(
              `Cotizados ${fmtInt(delivery.quoted_liters)} L, observados ${fmtInt(delivery.observed_liters ?? 0)} L.`,
            );
            setOpening(true);
          }}
        >
          Abrir aclaración
        </button>
      )}
      {opening && (
        <form onSubmit={open} className="space-y-2" noValidate>
          <Field id="disc-text" label="¿Qué quieres aclarar?" hint="Solo lo verán tú y quien coordina." error={error}>
            <textarea id="disc-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} className={`${inputCls} py-2 text-lg`} />
          </Field>
          <button type="submit" className={primaryBtn}>
            Enviar a quien coordina
          </button>
        </form>
      )}
    </section>
  );
}

function DiscrepancyItem({
  d,
  ctx,
  canResolve,
  reload,
}: {
  d: Discrepancy;
  ctx: PipaCtx;
  canResolve: boolean;
  reload: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function resolve(e: React.FormEvent) {
    e.preventDefault();
    const parsed = discrepancyText.safeParse(note);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    try {
      await resolveDiscrepancy(ctx.sb, d.id, parsed.data);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-2 rounded-xl border-2 border-slate-200 p-3">
      <p className="text-base">{d.description}</p>
      <p className="text-sm text-slate-600">
        {d.status === "open" ? "Abierta" : "Resuelta"} · {fmtDateTime(Date.parse(d.created_at))}
      </p>
      {d.resolution_note && (
        <p className="text-base">
          <strong>Resolución:</strong> {d.resolution_note}
        </p>
      )}
      {canResolve && d.status === "open" && (
        <form onSubmit={resolve} className="space-y-2" noValidate>
          <Field id={`res-${d.id}`} label="Resolución" error={error}>
            <textarea id={`res-${d.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={`${inputCls} py-2 text-lg`} />
          </Field>
          <button type="submit" className={secondaryBtn}>
            Cerrar aclaración
          </button>
        </form>
      )}
    </div>
  );
}
