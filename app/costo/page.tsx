import Link from "next/link";
import CostWorksheet from "@/components/CostWorksheet";

export default function CostoPage() {
  return (
    <div className="space-y-5">
      <Link href="/ajustes" className="text-base text-blue-700 underline">
        ← Ajustes
      </Link>
      <h1 className="text-3xl font-bold">¿Cuánto cuesta en total?</h1>
      <CostWorksheet />
    </div>
  );
}
