"use client";

import { useEffect, useState } from "react";
import DataBanner from "@/components/DataBanner";
import LevelChart from "@/components/tank/LevelChart";
import type { WaterInSource } from "@/lib/analysis";
import { getEventTags, setEventTag } from "@/lib/db";
import { fmtDateTime, fmtInt, fmtTime } from "@/lib/format";
import { useTankData } from "@/lib/useTankData";

const TAGS: { value: WaterInSource; label: string }[] = [
  { value: "red", label: "Red" },
  { value: "pipa", label: "Pipa" },
  { value: "bomba", label: "Bomba" },
];

export default function WaterInHistory() {
  const { data } = useTankData();
  const [tags, setTags] = useState<Map<number, WaterInSource>>(new Map());

  useEffect(() => {
    getEventTags().then((t) => setTags(new Map(t.map((x) => [x.startTs, x.source]))));
  }, []);

  if (data === undefined) return <p className="text-lg text-slate-600">Cargando…</p>;
  if (data === null) return <p className="text-lg text-slate-600">Primero llena los datos de tu tinaco en la pestaña Tinaco.</p>;

  const events = [...data.analysis.events].reverse();
  const spanH = data.samples.length > 1 ? (data.samples.at(-1)!.ts - data.samples[0].ts) / 3600000 : 0;

  async function tag(startTs: number, source: WaterInSource) {
    await setEventTag({ startTs, source });
    setTags(new Map(tags).set(startTs, source));
  }

  return (
    <div className="space-y-4">
      <DataBanner sources={data.sources} />
      {spanH > 72 && (
        <LevelChart
          samples={data.samples}
          events={data.analysis.events}
          capacityL={data.cal.capacityL}
          hours={Math.min(28 * 24, Math.ceil(spanH))}
        />
      )}
      <h2 className="text-2xl font-bold">Entradas de agua</h2>
      {events.length === 0 ? (
        <p className="text-lg text-slate-600">Todavía no se detecta ninguna entrada de agua.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.start} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-lg font-semibold">
                {fmtDateTime(e.start)}–{fmtTime(e.end)}
              </p>
              <p className="text-base text-slate-700">Entraron unos +{fmtInt(e.litersIn)} L</p>
              <fieldset>
                <legend className="text-base text-slate-600">¿De dónde vino? (Red = tandeo)</legend>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {TAGS.map((t) => {
                    const on = tags.get(e.start) === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => tag(e.start, t.value)}
                        className={`min-h-12 rounded-xl border-2 text-base font-semibold ${
                          on ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-slate-600">
        Si tu tinaco se llena con bomba, sube cuando corre la bomba, no cuando llega el tandeo.
      </p>
    </div>
  );
}
