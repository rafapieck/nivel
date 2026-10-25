"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CalibrationForm from "@/components/CalibrationForm";
import CalibrationSummary from "@/components/CalibrationSummary";
import type { Calibration } from "@/lib/calibration";
import { getLatestCalibration } from "@/lib/db";

export default function TankHome() {
  const [cal, setCal] = useState<Calibration | null | undefined>(undefined);

  useEffect(() => {
    getLatestCalibration().then(setCal);
  }, []);

  if (cal === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;

  if (cal === null) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Declara tu tinaco</h1>
        <p className="text-lg text-slate-600">
          Toma unos 2 minutos. No necesitas cuenta: todo se guarda solo en este teléfono.
        </p>
        <CalibrationForm onSaved={setCal} submitLabel="Guardar mi tinaco" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Tinaco</h1>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <CalibrationSummary cal={cal} />
      </div>
      <Link href="/ajustes" className="block text-lg font-semibold text-blue-700 underline">
        Recalibrar en Ajustes
      </Link>
    </section>
  );
}
