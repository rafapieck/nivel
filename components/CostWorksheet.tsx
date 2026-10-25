"use client";

import { useState } from "react";
import { Field, card, inputCls } from "@/components/ui";
import { costInputs, costTotals, type CostInputs } from "@/lib/cost";
import { fmtInt, fmtMxn } from "@/lib/format";
import { toNumber } from "@/lib/pipaSchemas";

type Key = keyof Required<CostInputs>;

const FIELDS: { key: Key; label: string; unit: string; hint?: string }[] = [
  { key: "sensorMxn", label: "Sensor", unit: "MXN", hint: "Precio del sensor por tinaco." },
  { key: "installMxn", label: "Instalación", unit: "MXN" },
  { key: "supportMxnMonth", label: "Soporte al mes", unit: "MXN" },
  { key: "nivelMinutesPerOrder", label: "Minutos de quien coordina por pedido, con Nivel", unit: "min" },
  { key: "ordersPerMonth", label: "Pedidos de pipa al mes", unit: "" },
  {
    key: "whatsappMinutesPerOrder",
    label: "Minutos por pedido hoy, con WhatsApp",
    unit: "min",
    hint: "Mensajes, cobrar, anotar quién pagó, aclarar.",
  },
];

export default function CostWorksheet() {
  const [raw, setRaw] = useState<Record<Key, string>>(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<Key, string>,
  );

  const values: CostInputs = {};
  const errors: Partial<Record<Key, string>> = {};
  for (const f of FIELDS) {
    if (raw[f.key].trim() === "") continue;
    const parsed = costInputs.shape[f.key].safeParse(toNumber(raw[f.key]));
    if (parsed.success) values[f.key] = parsed.data;
    else errors[f.key] = Number.isNaN(toNumber(raw[f.key])) ? "Escribe un número" : parsed.error.issues[0].message;
  }
  const t = costTotals(values);
  const show = (n: number | null, f: (n: number) => string) => (n === null ? "—" : f(n));

  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-yellow-300 px-3 py-2 text-center text-base font-bold text-yellow-950">
        Valores de ejemplo — no son ahorros observados.
      </p>
      <p className="text-base text-slate-600">
        Escribe tus propios números. Nada viene lleno y no calculamos ningún ahorro por ti.
      </p>

      <section className={card} aria-labelledby="entradas">
        <h2 id="entradas" className="text-xl font-bold">
          Tus números
        </h2>
        {FIELDS.map((f) => (
          <Field key={f.key} id={`c-${f.key}`} label={f.label} hint={f.hint} unit={f.unit || undefined} error={errors[f.key]}>
            <input
              id={`c-${f.key}`}
              inputMode="decimal"
              value={raw[f.key]}
              onChange={(e) => setRaw({ ...raw, [f.key]: e.target.value })}
              aria-invalid={!!errors[f.key]}
              className={inputCls}
            />
          </Field>
        ))}
      </section>

      <section className={card} aria-labelledby="totales">
        <h2 id="totales" className="text-xl font-bold">
          Totales
        </h2>
        <dl className="space-y-2 text-lg">
          <div className="flex justify-between gap-2">
            <dt>Costo inicial (sensor + instalación)</dt>
            <dd className="whitespace-nowrap font-bold">{show(t.upfrontMxn, fmtMxn)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Costo del primer año (con 12 meses de soporte)</dt>
            <dd className="whitespace-nowrap font-bold">{show(t.firstYearMxn, fmtMxn)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Minutos de coordinación al mes con Nivel</dt>
            <dd className="whitespace-nowrap font-bold">{show(t.nivelMinutesMonth, (n) => `${fmtInt(n)} min`)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Minutos de coordinación al mes con WhatsApp</dt>
            <dd className="whitespace-nowrap font-bold">{show(t.whatsappMinutesMonth, (n) => `${fmtInt(n)} min`)}</dd>
          </div>
        </dl>
        <p className="text-sm text-slate-600">
          Solo totales de lo que escribiste. Los minutos con Nivel se pueden medir en pedidos reales.
        </p>
      </section>
    </div>
  );
}
