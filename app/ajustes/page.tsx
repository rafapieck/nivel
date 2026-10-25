import Link from "next/link";
import CalibrationSettings from "@/components/CalibrationSettings";
import DataSettings from "@/components/DataSettings";

export default function AjustesPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Ajustes</h1>
      <CalibrationSettings />
      <DataSettings />
      <Link
        href="/costo"
        className="flex min-h-14 items-center justify-center rounded-xl border-2 border-slate-300 text-lg font-semibold text-slate-700"
      >
        Hoja de costo total
      </Link>
    </div>
  );
}
