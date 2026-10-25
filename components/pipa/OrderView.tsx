"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Field, Notice, card, inputCls, secondaryBtn } from "@/components/ui";
import { fmtInt, fmtMxn } from "@/lib/format";
import DeliverySection, { type DeliveryData } from "@/components/pipa/DeliverySection";
import {
  STATUS_LABEL,
  coordinatorOf,
  errorMessage,
  getDelivery,
  getGroup,
  getOrder,
  getTotals,
  listDiscrepancies,
  listShares,
  listSummaries,
  myMember,
  saveShare,
  type Group,
  type Member,
  type Order,
  type Share,
  type Totals,
} from "@/lib/pipa";
import { PAYMENT_LABEL, PAYMENT_METHODS, liters, toNumber, type PaymentMethod } from "@/lib/pipaSchemas";
import { usePipa, type PipaCtx } from "@/lib/usePipa";

export type OrderData = {
  order: Order;
  group: Group;
  shares: Share[];
  totals: Totals | null;
  me: Member | undefined;
  isCoordinator: boolean;
  dd: DeliveryData;
};

export default function OrderView() {
  const id = useSearchParams().get("id") ?? "";
  const ctx = usePipa();
  if (ctx === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (ctx === null) {
    return (
      <div className="space-y-3">
        <p className="text-lg">Entra con Google en la pestaña Pipa para ver el pedido.</p>
        <Link href="/pipa" className="text-lg font-semibold text-blue-700 underline">
          Ir a Pipa
        </Link>
      </div>
    );
  }
  return <Loaded key={id} ctx={ctx} id={id} />;
}

function Loaded({ ctx, id }: { ctx: PipaCtx; id: string }) {
  const { sb, session } = ctx;
  const [data, setData] = useState<OrderData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const order = await getOrder(sb, id);
      if (!order) return setData(null);
      const [group, shares, totals, delivery, summaries, discrepancies] = await Promise.all([
        getGroup(sb, order.group_id),
        listShares(sb, id),
        getTotals(sb, id),
        getDelivery(sb, id),
        listSummaries(sb, id),
        listDiscrepancies(sb, id),
      ]);
      if (!group) return setData(null);
      setData({
        order,
        group,
        shares,
        totals,
        me: myMember(group, session.user.id),
        isCoordinator: coordinatorOf(group)?.user_id === session.user.id,
        dd: { delivery, summaries, discrepancies },
      });
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [sb, id, session.user.id]);

  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);

  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (data === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (data === null) return <Notice tone="error">No encontramos ese pedido, o no eres parte del grupo.</Notice>;

  const { order, group, totals, me, isCoordinator } = data;
  const myShare = data.shares.find((s) => s.member_id === me?.id);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href={`/pipa/grupo?id=${group.id}`} className="text-base text-blue-700 underline">
          ← {group.name}
        </Link>
        <h1 className="text-3xl font-bold">{order.supplier_label}</h1>
        <p className="text-lg text-slate-700">
          {fmtInt(order.quoted_liters)} L cotizados · {fmtMxn(order.quoted_price_mxn)} · {STATUS_LABEL[order.status]}
        </p>
      </header>

      {totals && (
        <section className={card} aria-label="Recolectado">
          <p className="text-2xl font-semibold">
            Recolectado {fmtMxn(totals.collected_mxn)} de {fmtMxn(totals.total_mxn)}
          </p>
          <p className="text-base text-slate-600">
            {fmtInt(totals.requested_liters)} L pedidos de {fmtInt(order.quoted_liters)} L cotizados ·{" "}
            {totals.shares} hogares
          </p>
        </section>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {me && (
        <ShareEditor
          title="Lo mío"
          ctx={ctx}
          order={order}
          memberId={me.id}
          share={myShare}
          onSaved={reload}
          onError={setError}
        />
      )}

      <DeliverySection data={data} dd={data.dd} ctx={ctx} reload={reload} />

      {isCoordinator && <CoordinatorPanel data={data} ctx={ctx} onSaved={reload} onError={setError} />}

      <p className="text-base text-slate-600">
        Nivel solo anota los pagos: no cobra ni mueve dinero. Estar en &quot;Pendiente&quot; no saca a
        nadie del pedido ni de la entrega. Lo que pagó cada quien solo lo ven esa persona y quien
        coordina; el grupo ve el total.
      </p>
    </div>
  );
}

/** Liters and payment for one member. share_mxn is computed by the server and only displayed. */
function ShareEditor({
  title,
  subtitle,
  ctx,
  order,
  memberId,
  share,
  onSaved,
  onError,
}: {
  title: string;
  subtitle?: string;
  ctx: PipaCtx;
  order: Order;
  memberId: string;
  share: Share | undefined;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [litersStr, setLiters] = useState(share ? String(share.requested_liters) : "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canEditLiters = order.status === "open";
  const idBase = `share-${memberId}`;

  async function save(patch: { requested_liters?: number; payment_method?: PaymentMethod }) {
    setBusy(true);
    try {
      await saveShare(ctx.sb, order.id, memberId, patch);
      onError(null);
      onSaved();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function submitLiters(e: React.FormEvent) {
    e.preventDefault();
    const parsed = liters.safeParse(toNumber(litersStr));
    if (!parsed.success) return setFieldError(parsed.error.issues[0].message);
    setFieldError(null);
    save({ requested_liters: parsed.data });
  }

  return (
    <section className={card} aria-label={title}>
      <h2 className="text-xl font-bold">{title}</h2>
      {subtitle && <p className="text-base text-slate-600">{subtitle}</p>}
      {canEditLiters ? (
        <form onSubmit={submitLiters} className="space-y-2" noValidate>
          <Field id={`${idBase}-l`} label={subtitle ? "Litros que pide" : "Litros que pido"} unit="L" error={fieldError}>
            <input
              id={`${idBase}-l`}
              inputMode="numeric"
              value={litersStr}
              onChange={(e) => setLiters(e.target.value)}
              aria-invalid={!!fieldError}
              className={inputCls}
            />
          </Field>
          <button type="submit" disabled={busy} className={secondaryBtn}>
            Guardar litros
          </button>
        </form>
      ) : (
        share && <p className="text-lg">{fmtInt(share.requested_liters)} L pedidos</p>
      )}

      {share ? (
        <>
          <p className="text-lg">
            Te toca: <strong>{fmtMxn(share.share_mxn)}</strong>
          </p>
          {share.rounding_mxn > 0 && (
            <p className="text-base text-slate-600">
              Incluye {fmtMxn(share.rounding_mxn)} de ajuste por redondeo (va en la línea de quien
              coordina).
            </p>
          )}
          <PaymentButtons value={share.payment_method} disabled={busy} onPick={(m) => save({ payment_method: m })} />
        </>
      ) : (
        <p className="text-base text-slate-600">Pide litros para ver cuánto te toca.</p>
      )}
    </section>
  );
}

function PaymentButtons({
  value,
  disabled,
  onPick,
}: {
  value: PaymentMethod;
  disabled: boolean;
  onPick: (m: PaymentMethod) => void;
}) {
  return (
    <fieldset>
      <legend className="text-base text-slate-600">Pago</legend>
      <div className="mt-1 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            aria-pressed={value === m}
            onClick={() => onPick(m)}
            className={`min-h-12 rounded-xl border-2 px-1 text-sm font-semibold sm:text-base ${
              value === m ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700"
            }`}
          >
            {PAYMENT_LABEL[m]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The coordinator sees every line, and edits liters and payment for offline members only. */
function CoordinatorPanel({
  data,
  ctx,
  onSaved,
  onError,
}: {
  data: OrderData;
  ctx: PipaCtx;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const { group, shares, order } = data;
  const members = group.nivel_group_members;
  return (
    <section className="space-y-3" aria-labelledby="coord">
      <h2 id="coord" className="text-2xl font-bold">
        Para quien coordina
      </h2>
      <ul className={card} aria-label="Todas las líneas">
        {members.map((m) => {
          const s = shares.find((x) => x.member_id === m.id);
          return (
            <li key={m.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <p className="text-lg font-semibold">
                {m.display_name}
                {m.is_offline && <span className="text-base font-normal text-slate-600"> · sin teléfono</span>}
              </p>
              {s ? (
                <p className="text-base text-slate-700">
                  {fmtInt(s.requested_liters)} L · {fmtMxn(s.share_mxn)} · {PAYMENT_LABEL[s.payment_method]}
                  {s.rounding_mxn > 0 && (
                    <span className="block text-sm text-slate-600">Incluye {fmtMxn(s.rounding_mxn)} de redondeo</span>
                  )}
                </p>
              ) : (
                <p className="text-base text-slate-600">Aún no pide litros</p>
              )}
            </li>
          );
        })}
      </ul>
      {members
        .filter((m) => m.is_offline)
        .map((m) => (
          <ShareEditor
            key={m.id}
            title={m.display_name}
            subtitle="Sin teléfono: tú anotas sus litros y su pago."
            ctx={ctx}
            order={order}
            memberId={m.id}
            share={shares.find((s) => s.member_id === m.id)}
            onSaved={onSaved}
            onError={onError}
          />
        ))}
    </section>
  );
}
