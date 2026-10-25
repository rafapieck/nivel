"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { takePendingInvite } from "@/lib/usePipa";

/** Google sends the user back here; the Supabase client exchanges ?code= for a session. */
export default function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    const params = new URLSearchParams(window.location.search);
    if (!sb || params.has("error")) {
      Promise.resolve().then(() => setFailed(true));
      return;
    }
    // getSession waits for the client's own code exchange to finish.
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) return setFailed(true);
      const invite = takePendingInvite();
      router.replace(invite ? `/pipa/unirse?c=${encodeURIComponent(invite)}` : "/pipa");
    });
  }, [router]);

  if (!failed) return <p className="text-lg text-slate-600">Entrando…</p>;
  return (
    <section className="space-y-3">
      <p className="text-lg">No se pudo completar el inicio de sesión.</p>
      <Link href="/pipa" className="text-lg font-semibold text-blue-700 underline">
        Volver a Pipa
      </Link>
    </section>
  );
}
