"use client";

import { useState } from "react";
import {
  SENSOR_BLIND_ZONE_CM,
  TANK_TYPES,
  TANK_TYPE_LABEL,
  calibrationInput,
  type Calibration,
  type TankType,
} from "@/lib/calibration";
import { addCalibration } from "@/lib/db";

type Field = "type" | "capacityL" | "dFullCm" | "dEmptyCm";

const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

export default function CalibrationForm({
  initial,
  submitLabel = "Guardar",
  onSaved,
}: {
  initial?: Calibration | null;
  submitLabel?: string;
  onSaved: (cal: Calibration) => void;
}) {
  const [type, setType] = useState<TankType>(initial?.type ?? "tinaco");
  const [capacity, setCapacity] = useState(initial ? String(initial.capacityL) : "");
  const [dFull, setDFull] = useState(initial ? String(initial.dFullCm) : "");
  const [dEmpty, setDEmpty] = useState(initial ? String(initial.dEmptyCm) : "");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);

  const blindZoneWarning = toNumber(dFull) < SENSOR_BLIND_ZONE_CM;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = calibrationInput.safeParse({
      type,
      capacityL: toNumber(capacity),
      dFullCm: toNumber(dFull),
      dEmptyCm: toNumber(dEmpty),
    });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      onSaved(await addCalibration(parsed.data));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">¿Qué tienes?</legend>
        <div className="grid grid-cols-2 gap-2">
          {TANK_TYPES.map((t) => (
            <label
              key={t}
              className={`flex min-h-14 items-center justify-center rounded-xl border-2 px-2 text-center text-base font-semibold ${
                type === t ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="sr-only"
              />
              {TANK_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <NumberField
        id="capacity"
        label="Capacidad"
        unit="L"
        hint="Viene en la etiqueta del tinaco, por ejemplo 1,100 L."
        value={capacity}
        onChange={setCapacity}
        error={errors.capacityL}
      />
      <NumberField
        id="dFull"
        label="Distancia cuando está lleno"
        unit="cm"
        hint="Del sensor (o la tapa) al agua con el tinaco lleno."
        value={dFull}
        onChange={setDFull}
        error={errors.dFullCm}
      />
      {blindZoneWarning && !errors.dFullCm && (
        <p className="rounded-lg bg-amber-50 p-3 text-base text-amber-900">
          Ojo: muchos sensores no miden bien a menos de 20–25 cm. Revisa la hoja de tu sensor.
        </p>
      )}
      <NumberField
        id="dEmpty"
        label="Distancia cuando está vacío"
        unit="cm"
        hint="Del sensor (o la tapa) al fondo del tinaco."
        value={dEmpty}
        onChange={setDEmpty}
        error={errors.dEmptyCm}
      />

      <p className="text-base text-slate-600">Supone un tinaco cilíndrico vertical.</p>

      <button
        type="submit"
        disabled={saving}
        className="min-h-14 w-full rounded-xl bg-blue-700 text-lg font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}

function NumberField({
  id,
  label,
  unit,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  unit: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-lg font-semibold">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-base text-slate-600">
        {hint}
      </p>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          className="min-h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xl"
        />
        <span className="w-8 text-lg text-slate-600">{unit}</span>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-base font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
