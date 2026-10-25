"use client";

import { useEffect, useState } from "react";
import CalibrationForm from "@/components/CalibrationForm";
import CalibrationSummary from "@/components/CalibrationSummary";
import type { Calibration } from "@/lib/calibration";
import { listCalibrations } from "@/lib/db";
import { fmtDateTime, fmtInt } from "@/lib/format";

export default function CalibrationSettings() {
  const [cals, setCals] = useState<Calibration[] | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    listCalibrations().then(setCals);
  }, []);

  if (cals === null) return <p className="text-lg text-slate-600">Cargando…</p>;
  const [current, ...previous] = cals;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Calibración</h2>
      {current ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <CalibrationSummary cal={current} />
        </div>
      ) : (
        <p className="text-lg text-slate-600">Aún no declaras tu tinaco.</p>
      )}

      {editing || !current ? (
        <CalibrationForm
          initial={current}
          submitLabel={current ? "Guardar nueva calibración" : "Guardar mi tinaco"}
          onSaved={(cal) => {
            setCals([cal, ...cals]);
            setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-14 w-full rounded-xl border-2 border-blue-700 text-lg font-semibold text-blue-700"
        >
          Recalibrar
        </button>
      )}
      <p className="text-base text-slate-600">
        Recalibrar guarda una calibración nueva con fecha; las anteriores se conservan.
      </p>

      {previous.length > 0 && (
        <details className="rounded-2xl bg-white p-4 shadow-sm">
          <summary className="text-lg font-semibold">
            Calibraciones anteriores ({previous.length})
          </summary>
          <ul className="mt-2 space-y-1 text-base">
            {previous.map((c) => (
              <li key={c.id}>
                {fmtDateTime(c.createdAt)} · {fmtInt(c.capacityL)} L · {c.dFullCm}–{c.dEmptyCm} cm
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
