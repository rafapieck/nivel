"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readingsToCsv } from "@/lib/csv";
import { clearAllData, getAllReadings } from "@/lib/db";

export default function DataSettings() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportCsv() {
    const readings = await getAllReadings();
    if (readings.length === 0) return setMessage("No hay lecturas para exportar.");
    const blob = new Blob([readingsToCsv(readings)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nivel-lecturas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Se descargaron ${readings.length} lecturas.`);
  }

  async function wipe() {
    await clearAllData();
    setConfirming(false);
    router.push("/");
  }

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold">Mis datos</h2>
      <p className="text-base text-slate-600">
        Tus lecturas solo están en este teléfono. Descarga una copia si quieres guardarlas.
      </p>
      <button
        type="button"
        onClick={exportCsv}
        className="min-h-14 w-full rounded-xl border-2 border-blue-700 text-lg font-semibold text-blue-700"
      >
        Exportar mis lecturas (CSV)
      </button>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-14 w-full rounded-xl border-2 border-red-700 text-lg font-semibold text-red-700"
        >
          Borrar mis datos
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl bg-red-50 p-4">
          <p className="text-lg text-red-900">
            Se borrarán tu calibración, tus lecturas y tus etiquetas de este teléfono. No se puede
            deshacer.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-14 rounded-xl border-2 border-slate-300 text-lg font-semibold"
            >
              Cancelar
            </button>
            <button type="button" onClick={wipe} className="min-h-14 rounded-xl bg-red-700 text-lg font-semibold text-white">
              Sí, borrar
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="text-base text-slate-700">
          {message}
        </p>
      )}
    </section>
  );
}
