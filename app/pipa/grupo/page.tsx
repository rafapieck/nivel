import { Suspense } from "react";
import GroupView from "@/components/pipa/GroupView";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-lg text-slate-600">Cargando…</p>}>
      <GroupView />
    </Suspense>
  );
}
