"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Field, Notice, card, inputCls, primaryBtn, secondaryBtn } from "@/components/ui";
import { fmtDateTime, fmtInt, fmtMxn } from "@/lib/format";
import {
  STATUS_LABEL,
  addOfflineMember,
  coordinatorOf,
  errorMessage,
  getGroup,
  listOrders,
  openOrder,
  type Group,
  type Order,
} from "@/lib/pipa";
import { DELIVERY_MODE_LABEL, displayName, openOrderInput, toNumber } from "@/lib/pipaSchemas";
import { usePipa, type PipaCtx } from "@/lib/usePipa";
import { fieldErrors } from "@/components/ui";

export default function GroupView() {
  const id = useSearchParams().get("id") ?? "";
  const ctx = usePipa();
  if (ctx === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (ctx === null) return <BackToPipa text="Entra con Google en la pestaña Pipa para ver tu grupo." />;
  return <Loaded key={id} ctx={ctx} id={id} />;
}

function BackToPipa({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      <p className="text-lg">{text}</p>
      <Link href="/pipa" className="text-lg font-semibold text-blue-700 underline">
        Ir a Pipa
      </Link>
    </div>
  );
}

function Loaded({ ctx, id }: { ctx: PipaCtx; id: string }) {
  const { sb, session } = ctx;
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      Promise.all([getGroup(sb, id), listOrders(sb, id)])
        .then(([g, o]) => {
          setGroup(g);
          setOrders(o);
        })
        .catch((e) => setError(errorMessage(e))),
    [sb, id],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (group === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (group === null) return <BackToPipa text="No encontramos ese grupo, o no eres parte de él." />;

  const coord = coordinatorOf(group);
  const isCoordinator = coord?.user_id === session.user.id;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/pipa" className="text-base text-blue-700 underline">
          ← Mis grupos
        </Link>
        <h1 className="text-3xl font-bold">{group.name}</h1>
        <p className="text-base text-slate-600">
          {DELIVERY_MODE_LABEL[group.delivery_mode]} · Coordina <strong>{coord?.display_name ?? "—"}</strong>
        </p>
      </header>

      <section className={card} aria-labelledby="pedidos">
        <h2 id="pedidos" className="text-xl font-bold">
          Pedidos de pipa
        </h2>
        {orders.length === 0 && <p className="text-base text-slate-600">Aún no hay pedidos.</p>}
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/pipa/pedido?id=${o.id}`} className="block rounded-xl border-2 border-slate-200 p-3">
                <span className="block text-lg font-semibold">
                  {o.supplier_label} · {STATUS_LABEL[o.status]}
                </span>
                <span className="block text-base text-slate-600">
                  {fmtInt(o.quoted_liters)} L · {fmtMxn(o.quoted_price_mxn)} · {fmtDateTime(Date.parse(o.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {isCoordinator && <OpenOrderForm ctx={ctx} groupId={group.id} onDone={reload} />}
      </section>

      <MembersCard group={group} isCoordinator={isCoordinator} ctx={ctx} onChange={reload} />
      <InviteCard code={group.invite_code} />
    </div>
  );
}

function MembersCard({
  group,
  isCoordinator,
  ctx,
  onChange,
}: {
  group: Group;
  isCoordinator: boolean;
  ctx: PipaCtx;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = displayName.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    try {
      await addOfflineMember(ctx.sb, group.id, parsed.data, ctx.session.user.id);
      setName("");
      setError(null);
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card} aria-labelledby="hogares">
      <h2 id="hogares" className="text-xl font-bold">
        Hogares ({group.nivel_group_members.length})
      </h2>
      <ul className="space-y-1 text-lg">
        {group.nivel_group_members.map((m) => (
          <li key={m.id}>
            {m.display_name}
            {m.id === group.coordinator_member_id && <span className="text-base text-slate-600"> · coordina</span>}
            {m.is_offline && <span className="text-base text-slate-600"> · sin teléfono</span>}
          </li>
        ))}
      </ul>
      {isCoordinator && (
        <form onSubmit={add} className="space-y-2 border-t border-slate-200 pt-3" noValidate>
          <Field
            id="offline-name"
            label="Agregar un hogar sin teléfono"
            hint="Tú anotas sus litros y su pago."
            error={error}
          >
            <input
              id="offline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              aria-invalid={!!error}
              className={inputCls}
            />
          </Field>
          <button type="submit" disabled={busy} className={secondaryBtn}>
            Agregar
          </button>
        </form>
      )}
    </section>
  );
}

function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    Promise.resolve().then(() => setLink(`${window.location.origin}/pipa/unirse?c=${code}`));
  }, [code]);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Únete a la pipa en Nivel", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      // User cancelled the share sheet.
    }
  }

  return (
    <section className={card} aria-labelledby="invitar">
      <h2 id="invitar" className="text-xl font-bold">
        Invitar vecinos
      </h2>
      <p className="break-all rounded-lg bg-slate-100 p-3 text-base">{link}</p>
      <button type="button" onClick={share} className={primaryBtn}>
        Compartir invitación
      </button>
      {copied && <Notice tone="ok">Enlace copiado. Pégalo en WhatsApp.</Notice>}
    </section>
  );
}

function OpenOrderForm({ ctx, groupId, onDone }: { ctx: PipaCtx; groupId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [litersStr, setLiters] = useState("");
  const [priceStr, setPrice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
        Abrir un pedido
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = openOrderInput.safeParse({
      supplierLabel: supplier,
      quotedLiters: toNumber(litersStr),
      quotedPriceMxn: toNumber(priceStr),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await openOrder(ctx.sb, groupId, ctx.session.user.id, parsed.data);
      setOpen(false);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-200 pt-3" noValidate>
      <h3 className="text-lg font-bold">Nuevo pedido</h3>
      <Field id="o-supplier" label="Proveedor" hint="Un nombre para reconocerlo, por ejemplo: Pipas Don Chuy" error={errors.supplierLabel}>
        <input id="o-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={60} aria-invalid={!!errors.supplierLabel} className={inputCls} />
      </Field>
      <Field id="o-liters" label="Litros cotizados" unit="L" error={errors.quotedLiters}>
        <input id="o-liters" inputMode="numeric" value={litersStr} onChange={(e) => setLiters(e.target.value)} aria-invalid={!!errors.quotedLiters} className={inputCls} />
      </Field>
      <Field id="o-price" label="Precio cotizado" unit="MXN" error={errors.quotedPriceMxn}>
        <input id="o-price" inputMode="decimal" value={priceStr} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!errors.quotedPriceMxn} className={inputCls} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? "Abriendo…" : "Abrir pedido"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
        Cancelar
      </button>
    </form>
  );
}
