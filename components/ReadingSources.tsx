"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DataBanner from "@/components/DataBanner";
import { distanceCm, type Calibration } from "@/lib/calibration";
import { parseReadingsCsv, type CsvRowError } from "@/lib/csv";
import {
  addReadings,
  deleteReadingsBySource,
  getAllReadings,
  getLatestCalibration,
  replaceSimulatedReadings,
} from "@/lib/db";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { READING_SOURCES, SOURCE_LABEL, readingPoint, type Reading } from "@/lib/readings";
import { SCENARIOS, SCENARIO_LABEL, simulateReadings, type Scenario } from "@/lib/simulator";

const card = "space-y-3 rounded-2xl bg-white p-4 shadow-sm";
const primaryBtn =
  "min-h-14 w-full rounded-xl bg-blue-700 px-4 text-lg font-semibold text-white disabled:opacity-60";
const secondaryBtn =
  "min-h-12 w-full rounded-xl border-2 border-slate-300 px-4 text-base font-semibold text-slate-700";

/** Value for <input type="datetime-local"> in local time. */
function toLocalInput(ts: number) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function ReadingSources() {
  const [cal, setCal] = useState<Calibration | null | undefined>(undefined);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(() => getAllReadings().then(setReadings), []);

  // Re-runs whenever the page becomes visible again (routes stay mounted while hidden).
  useEffect(() => {
    getLatestCalibration().then(setCal);
    reload().then(() => setMessage(null));
  }, [reload]);

  if (cal === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (cal === null) {
    return (
      <p className="text-lg">
        Primero{" "}
        <Link href="/" className="font-semibold text-blue-700 underline">
          declara tu tinaco
        </Link>
        .
      </p>
    );
  }

  const counts = READING_SOURCES.map((s) => [s, readings.filter((r) => r.source === s).length] as const);

  return (
    <div className="space-y-5">
      <DataBanner sources={readings.map((r) => r.source)} />

      <section className={card} aria-labelledby="resumen">
        <h2 id="resumen" className="text-xl font-bold">
          En este teléfono
        </h2>
        <ul className="text-base">
          {counts.map(([s, n]) => (
            <li key={s}>
              {SOURCE_LABEL[s]}: <strong>{fmtInt(n)}</strong> lecturas
            </li>
          ))}
        </ul>
        {readings.length > 0 && (
          <p className="text-base text-slate-600">
            Del {fmtDateTime(readings[0].ts)} al {fmtDateTime(readings.at(-1)!.ts)}
          </p>
        )}
        <p className="text-base text-slate-600">Las lecturas no salen de este teléfono.</p>
      </section>

      {message && (
        <p role="status" className="rounded-lg bg-blue-50 p-3 text-base text-blue-900">
          {message}
        </p>
      )}

      <SimulatorCard cal={cal} onDone={(m) => reload().then(() => setMessage(m))} />
      <CsvCard cal={cal} onDone={(m) => reload().then(() => setMessage(m))} />
      <ManualCard cal={cal} onDone={(m) => reload().then(() => setMessage(m))} />
    </div>
  );
}

function SimulatorCard({ cal, onDone }: { cal: Calibration; onDone: (msg: string) => void }) {
  const [scenario, setScenario] = useState<Scenario>("tandeo");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const points = simulateReadings(scenario, cal, { seed: Date.now() % 100000 });
      const n = await replaceSimulatedReadings(points, cal.id);
      onDone(`Simulación cargada: ${fmtInt(n)} lecturas (${SCENARIO_LABEL[scenario]}).`);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await deleteReadingsBySource("simulated");
    onDone("Se borraron las lecturas simuladas.");
  }

  return (
    <section className={card} aria-labelledby="sim">
      <h2 id="sim" className="text-xl font-bold">
        Simulador
      </h2>
      <p className="text-base text-slate-600">
        Imita un sensor que mide cada 10 minutos (mediana de 5 mediciones, ±1 cm de ruido). Datos
        inventados para probar la app.
      </p>
      <label htmlFor="scenario" className="block text-lg font-semibold">
        Escenario
      </label>
      <select
        id="scenario"
        value={scenario}
        onChange={(e) => setScenario(e.target.value as Scenario)}
        className="min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-lg"
      >
        {SCENARIOS.map((s) => (
          <option key={s} value={s}>
            {SCENARIO_LABEL[s]}
          </option>
        ))}
      </select>
      <button type="button" onClick={load} disabled={busy} className={primaryBtn}>
        {busy ? "Cargando…" : "Cargar simulación"}
      </button>
      <p className="text-sm text-slate-600">Reemplaza la simulación anterior. No toca tus lecturas reales.</p>
      <button type="button" onClick={clear} className={secondaryBtn}>
        Borrar lecturas simuladas
      </button>
    </section>
  );
}

function CsvCard({ cal, onDone }: { cal: Calibration; onDone: (msg: string) => void }) {
  const [errors, setErrors] = useState<CsvRowError[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 2_000_000) {
        setErrors([{ line: 0, message: "El archivo es muy grande (máximo 2 MB)" }]);
        return;
      }
      const { rows, errors } = parseReadingsCsv(await file.text());
      setErrors(errors);
      const n = rows.length ? await addReadings(rows, "csv", cal.id) : 0;
      const repeated = rows.length - n;
      onDone(
        `CSV: ${fmtInt(n)} lecturas importadas` +
          (repeated ? `, ${fmtInt(repeated)} ya estaban guardadas` : "") +
          (errors.length ? `, ${fmtInt(errors.length)} filas con error.` : "."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card} aria-labelledby="csv">
      <h2 id="csv" className="text-xl font-bold">
        Importar CSV del sensor
      </h2>
      <p className="text-base text-slate-600">
        Formato: <code className="rounded bg-slate-100 px-1">timestamp,distance_cm</code>. La fecha
        puede ser ISO (2026-10-20T14:10:00) o tiempo Unix.
      </p>
      <label className={`${primaryBtn} flex cursor-pointer items-center justify-center`}>
        {busy ? "Importando…" : "Elegir archivo CSV"}
        <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="sr-only" />
      </label>
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3 text-base text-red-900">
          <p className="font-semibold">Filas que no se importaron:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.slice(0, 20).map((err) => (
              <li key={`${err.line}-${err.message}`}>
                {err.line > 0 ? `Fila ${err.line}: ` : ""}
                {err.message}
              </li>
            ))}
          </ul>
          {errors.length > 20 && <p className="mt-1">…y {fmtInt(errors.length - 20)} más.</p>}
        </div>
      )}
    </section>
  );
}

function ManualCard({ cal, onDone }: { cal: Calibration; onDone: (msg: string) => void }) {
  const [distance, setDistance] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(Date.now()));
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = distance.trim() === "" ? NaN : Number(distance.replace(",", "."));
    const dist = distanceCm.safeParse(d);
    if (!dist.success) return setError(dist.error.issues[0].message);
    const parsed = readingPoint.safeParse({ ts: new Date(when).getTime(), distanceCm: dist.data });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    const n = await addReadings([parsed.data], "manual", cal.id);
    setDistance("");
    onDone(n ? "Lectura manual guardada." : "Ya había una lectura manual a esa hora.");
  }

  return (
    <section className={card} aria-labelledby="manual">
      <h2 id="manual" className="text-xl font-bold">
        Medir a mano
      </h2>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label htmlFor="manual-d" className="block text-lg font-semibold">
          ¿A cuántos cm del borde está el agua?
        </label>
        <div className="flex items-center gap-2">
          <input
            id="manual-d"
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl"
          />
          <span className="w-8 text-lg text-slate-600">cm</span>
        </div>
        <label htmlFor="manual-when" className="block text-lg font-semibold">
          ¿Cuándo?
        </label>
        <input
          id="manual-when"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-lg"
        />
        {error && <p className="text-base font-medium text-red-700">{error}</p>}
        <button type="submit" className={primaryBtn}>
          Guardar lectura
        </button>
      </form>
    </section>
  );
}
