"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import SignInCard from "@/components/pipa/SignInCard";
import { Field, Notice, card, inputCls, primaryBtn } from "@/components/ui";
import { errorMessage, joinGroup } from "@/lib/pipa";
import { displayName, inviteCode } from "@/lib/pipaSchemas";
import { defaultDisplayName, savePendingInvite, usePipa, type PipaCtx } from "@/lib/usePipa";

export default function JoinView() {
  const code = useSearchParams().get("c") ?? "";
  const ctx = usePipa();
  const valid = inviteCode.safeParse(code).success;

  if (!valid) return <Notice tone="error">Esa invitación no es válida. Pide el enlace otra vez.</Notice>;
  if (ctx === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (ctx === null) {
    return (
      <SignInCard beforeSignIn={() => savePendingInvite(code)}>
        <p className="text-lg">Te invitaron a una pipa entre vecinos.</p>
        <p className="text-base text-slate-600">
          Entra con Google para unirte. Si no tienes cuenta, pide a quien coordina que te agregue
          por tu nombre.
        </p>
      </SignInCard>
    );
  }
  return <JoinForm key={code} ctx={ctx} code={code} />;
}

function JoinForm({ ctx, code }: { ctx: PipaCtx; code: string }) {
  const router = useRouter();
  const [name, setName] = useState(() => defaultDisplayName(ctx.session));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = displayName.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    try {
      const groupId = await joinGroup(ctx.sb, code, parsed.data);
      router.replace(`/pipa/grupo?id=${groupId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card} noValidate>
      <p className="text-lg">Te invitaron a una pipa entre vecinos.</p>
      <Field id="join-name" label="Tu nombre en el grupo" hint="Así te verán tus vecinos." error={error}>
        <input id="join-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={!!error} className={inputCls} />
      </Field>
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? "Uniéndote…" : "Unirme"}
      </button>
    </form>
  );
}
