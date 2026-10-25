"use client";

import { useState } from "react";
import { card, primaryBtn } from "@/components/ui";
import { getSupabase, signInWithGoogle } from "@/lib/supabase";

export default function SignInCard({
  children,
  beforeSignIn,
}: {
  children?: React.ReactNode;
  /** Runs right before leaving for Google, e.g. to remember an invite code. */
  beforeSignIn?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    beforeSignIn?.();
    const { error } = await signInWithGoogle(sb);
    if (error) {
      setError("No se pudo abrir el inicio de sesión. Intenta de nuevo.");
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      {children}
      <button type="button" onClick={signIn} disabled={busy} className={primaryBtn}>
        {busy ? "Abriendo Google…" : "Entrar con Google"}
      </button>
      {error && <p className="text-base font-medium text-red-700">{error}</p>}
    </section>
  );
}
