import { Suspense } from "react";
import JoinView from "@/components/pipa/JoinView";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-lg text-slate-600">Cargando…</p>}>
      <JoinView />
    </Suspense>
  );
}
