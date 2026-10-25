"use client";

import { useEffect, useState } from "react";
import { getSupabase, signInWithGoogle } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

const card = "space-y-3 rounded-2xl bg-white p-4 shadow-sm";
const primaryBtn =
  "flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-700 px-4 text-lg font-semibold text-white disabled:opacity-60";

type SchemaState = "checking" | "ready" | "missing" | "error";

export default function PipaHome() {
  const sb = getSupabase();
  const session = useSession();

  if (!sb) {
    return (
      <p className="text-lg text-slate-700">
        La pipa entre vecinos todavía no está configurada en este servidor.
      </p>
    );
  }
  if (session === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (session === null) return <SignedOut />;
  return <SignedIn email={session.user.email ?? ""} />;
}

function SignedOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    const { error } = await signInWithGoogle(sb);
    if (error) {
      setError("No se pudo abrir el inicio de sesión. Intenta de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className={card}>
        <p className="text-lg">
          Organiza una pipa con tus vecinos: quién pide cuántos litros, cuánto le toca pagar y qué
          llegó.
        </p>
        <p className="text-base text-slate-600">
          Para esto se necesita entrar con Google. Si un vecino no tiene teléfono o cuenta, quien
          coordina lo agrega por su nombre.
        </p>
        <button type="button" onClick={signIn} disabled={busy} className={primaryBtn}>
          {busy ? "Abriendo Google…" : "Entrar con Google"}
        </button>
        {error && <p className="text-base font-medium text-red-700">{error}</p>}
      </section>
      <p className="text-base text-slate-600">
        El tinaco funciona sin cuenta. Tus lecturas nunca se suben: solo compartes un resumen de
        cada pipa, si tú lo apruebas.
      </p>
    </div>
  );
}

function SignedIn({ email }: { email: string }) {
  const [schema, setSchema] = useState<SchemaState>("checking");

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("nivel_groups")
      .select("id", { count: "exact", head: true })
      .then(({ error }) => {
        if (!error) setSchema("ready");
        // 42P01 = undefined table; PGRST205 = table not in PostgREST's schema cache.
        else if (error.code === "42P01" || error.code === "PGRST205") setSchema("missing");
        else setSchema("error");
      });
  }, []);

  return (
    <div className="space-y-4">
      <section className={card}>
        <p className="text-lg">
          Entraste como <strong className="break-all">{email}</strong>
        </p>
        {schema === "checking" && <p className="text-base text-slate-600">Revisando…</p>}
        {schema === "ready" && (
          <p className="text-base text-slate-700">
            Todo listo. Crear grupos y pedidos de pipa llega en la siguiente versión.
          </p>
        )}
        {schema === "missing" && (
          <p className="rounded-lg bg-amber-50 p-3 text-base text-amber-900">
            Falta preparar la base de datos de la pipa. Quien administra Nivel debe correr la
            migración de Supabase.
          </p>
        )}
        {schema === "error" && (
          <p className="rounded-lg bg-red-50 p-3 text-base text-red-900">
            No se pudo conectar con la base de datos. Intenta más tarde.
          </p>
        )}
        <button
          type="button"
          onClick={() => getSupabase()?.auth.signOut()}
          className="min-h-12 w-full rounded-xl border-2 border-slate-300 text-base font-semibold text-slate-700"
        >
          Salir
        </button>
      </section>
    </div>
  );
}
