"use client";

import CalibrationForm from "@/components/CalibrationForm";
import TankDashboard from "@/components/tank/TankDashboard";
import { useTankData } from "@/lib/useTankData";

export default function TankHome() {
  const { data, reload } = useTankData();

  if (data === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;

  if (data === null) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Tu tinaco</h1>
        <p className="text-xl">Con esto te decimos cuántos días de agua te quedan.</p>
        <p className="text-lg text-slate-600">
          Toma unos 2 minutos. No necesitas cuenta: todo se guarda solo en este teléfono.
        </p>
        <CalibrationForm onSaved={() => reload()} submitLabel="Guardar mi tinaco" />
      </section>
    );
  }

  return <TankDashboard data={data} />;
}
