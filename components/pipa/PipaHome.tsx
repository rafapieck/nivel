"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SignInCard from "@/components/pipa/SignInCard";
import { Field, Notice, card, fieldErrors, inputCls, primaryBtn, secondaryBtn } from "@/components/ui";
import { coordinatorOf, createGroup, errorMessage, listMyGroups, type Group } from "@/lib/pipa";
import {
  DELIVERY_MODES,
  DELIVERY_MODE_LABEL,
  createGroupInput,
  type DeliveryMode,
} from "@/lib/pipaSchemas";
import { getSupabase } from "@/lib/supabase";
import { defaultDisplayName, usePipa, type PipaCtx } from "@/lib/usePipa";

export default function PipaHome() {
  const ctx = usePipa();

  if (!getSupabase()) {
    return (
      <p className="text-lg text-slate-700">
        La pipa entre vecinos todavía no está configurada en este servidor.
      </p>
    );
  }
  if (ctx === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (ctx === null) {
    return (
      <div className="space-y-4">
        <SignInCard>
          <p className="text-lg">
            Organiza una pipa con tus vecinos: quién pide cuántos litros, cuánto le toca pagar y qué
            llegó.
          </p>
          <p className="text-base text-slate-600">
            Para esto se necesita entrar con Google. Si un vecino no tiene teléfono o cuenta, quien
            coordina lo agrega por su nombre.
          </p>
        </SignInCard>
        <p className="text-base text-slate-600">
          El tinaco funciona sin cuenta. Tus lecturas nunca se suben: solo compartes un resumen de
          cada pipa, si tú lo apruebas.
        </p>
      </div>
    );
  }
  return <SignedIn ctx={ctx} />;
}

function SignedIn({ ctx }: { ctx: PipaCtx }) {
  const { sb, session } = ctx;
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      listMyGroups(sb)
        .then((g) => {
          setGroups(g);
          setError(null);
        })
        .catch((e) => setError(errorMessage(e))),
    [sb],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-5">
      <p className="text-base text-slate-600">
        Entraste como <strong className="break-all">{session.user.email}</strong>
      </p>
      {error && <Notice tone="error">{error}</Notice>}

      <section className="space-y-3" aria-labelledby="mis-grupos">
        <h2 id="mis-grupos" className="text-2xl font-bold">
          Mis grupos
        </h2>
        {groups === null && !error && <p className="text-lg text-slate-600">Cargando…</p>}
        {groups?.length === 0 && (
          <p className="text-lg text-slate-600">
            Aún no estás en ningún grupo. Crea uno o abre la invitación que te mandaron.
          </p>
        )}
        <ul className="space-y-2">
          {groups?.map((g) => (
            <li key={g.id}>
              <Link href={`/pipa/grupo?id=${g.id}`} className={`${card} block`}>
                <span className="block text-xl font-semibold">{g.name}</span>
                <span className="block text-base text-slate-600">
                  {g.nivel_group_members.length} hogares · Coordina{" "}
                  {coordinatorOf(g)?.display_name ?? "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CreateGroupForm ctx={ctx} onCreated={reload} />

      <button type="button" onClick={() => sb.auth.signOut()} className={secondaryBtn}>
        Salir
      </button>
    </div>
  );
}

function CreateGroupForm({ ctx, onCreated }: { ctx: PipaCtx; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [myName, setMyName] = useState(() => defaultDisplayName(ctx.session));
  const [mode, setMode] = useState<DeliveryMode>("cistern");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
        Crear un grupo
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createGroupInput.safeParse({ name, myName, mode });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await createGroup(ctx.sb, parsed.data.name, parsed.data.myName, parsed.data.mode);
      setOpen(false);
      setName("");
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card} noValidate>
      <h2 className="text-xl font-bold">Crear un grupo</h2>
      <p className="text-base text-slate-600">Tú quedas como la persona que coordina.</p>
      <Field id="g-name" label="Nombre del grupo" hint="Por ejemplo: Edificio Morelos 12" error={errors.name}>
        <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={!!errors.name} className={inputCls} />
      </Field>
      <Field id="g-me" label="Tu nombre en el grupo" error={errors.myName}>
        <input id="g-me" value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={60} aria-invalid={!!errors.myName} className={inputCls} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">¿Dónde descarga la pipa?</legend>
        <div className="grid grid-cols-2 gap-2">
          {DELIVERY_MODES.map((m) => (
            <label
              key={m}
              className={`flex min-h-14 items-center justify-center rounded-xl border-2 px-2 text-center text-base font-semibold ${
                mode === m ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 bg-white"
              }`}
            >
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
              {DELIVERY_MODE_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? "Creando…" : "Crear grupo"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
        Cancelar
      </button>
    </form>
  );
}
