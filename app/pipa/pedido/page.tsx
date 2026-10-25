import { Suspense } from "react";
import OrderView from "@/components/pipa/OrderView";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-lg text-slate-600">Cargando…</p>}>
      <OrderView />
    </Suspense>
  );
}
