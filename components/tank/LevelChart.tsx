"use client";

import { useState } from "react";
import { HOUR_MS, type Sample, type WaterInEvent } from "@/lib/analysis";
import { fmtDayMonth, fmtEventRange, fmtHour, fmtInt, fmtTime, fmtWeekday } from "@/lib/format";

const W = 340;
const H = 170;
const PAD = { l: 8, r: 8, t: 10, b: 26 };

/** Liters over the last `hours`, with water-in events shaded. One series, so no legend. */
export default function LevelChart({
  samples,
  events,
  capacityL,
  hours = 72,
}: {
  samples: Sample[];
  events: WaterInEvent[];
  capacityL: number;
  hours?: number;
}) {
  const [hover, setHover] = useState<Sample | null>(null);
  if (samples.length < 2) return null;

  const end = samples.at(-1)!.ts;
  const start = end - hours * HOUR_MS;
  const pts = samples.filter((p) => p.ts >= start);
  if (pts.length < 2) return null;
  const evs = events.filter((e) => e.end >= start);
  const latest = evs.at(-1);

  const x = (ts: number) => PAD.l + ((ts - start) / (end - start)) * (W - PAD.l - PAD.r);
  const y = (l: number) => PAD.t + (1 - l / capacityL) * (H - PAD.t - PAD.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)} ${y(p.liters).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.at(-1)!.ts).toFixed(1)} ${y(0)}L${x(pts[0].ts).toFixed(1)} ${y(0)}Z`;

  // Ticks on the local clock: every 12 h up to 3 days, then daily, then weekly.
  const stepH = hours <= 72 ? 12 : hours <= 7 * 24 ? 24 : 7 * 24;
  const ticks: number[] = [];
  const t0 = new Date(start);
  t0.setMinutes(0, 0, 0);
  if (stepH === 12) t0.setHours(Math.ceil(t0.getHours() / 12) * 12);
  else t0.setHours(24, 0, 0, 0);
  for (let t = t0.getTime(); t <= end; t += stepH * HOUR_MS) {
    // Skip labels that would be clipped at the edges.
    if (x(t) > 18 && x(t) < W - 18) ticks.push(t);
  }
  const tickLabel = (t: number) =>
    stepH > 24 ? fmtDayMonth(t) : new Date(t).getHours() === 0 ? fmtWeekday(t) : fmtHour(t);
  const title = hours <= 72 ? `Últimas ${hours} horas` : `Últimos ${Math.round(hours / 24)} días`;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const ts = start + (((e.clientX - box.left) / box.width) * W - PAD.l) / (W - PAD.l - PAD.r) * (end - start);
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.ts - ts) < Math.abs(best.ts - ts)) best = p;
    setHover(best);
  }

  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="chart-title">
      <h2 id="chart-title" className="text-xl font-bold">
        {title}
      </h2>
      {latest ? (
        <p className="text-base text-slate-800">
          Entró agua · {fmtEventRange(latest.start, latest.end)} · +{fmtInt(latest.litersIn)} L
        </p>
      ) : (
        <p className="text-base text-slate-600">No entró agua en este periodo.</p>
      )}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          role="img"
          aria-label={`Nivel del tinaco: ${title.toLowerCase()}`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(f * capacityL)} y2={y(f * capacityL)} stroke="#e2e8f0" strokeWidth="1" />
          ))}
          {evs.map((e) => (
            <rect
              key={e.start}
              x={x(Math.max(start, e.start))}
              width={Math.max(3, x(e.end) - x(Math.max(start, e.start)))}
              y={PAD.t}
              height={H - PAD.t - PAD.b}
              fill="#bbf7d0"
            />
          ))}
          <path d={area} fill="#bfdbfe" opacity="0.6" />
          <path d={line} fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinejoin="round" />
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="#475569">
              {tickLabel(t)}
            </text>
          ))}
          <text x={W - PAD.r} y={PAD.t + 10} textAnchor="end" fontSize="11" fill="#475569">
            {fmtInt(capacityL)} L
          </text>
          {hover && (
            <g>
              <line x1={x(hover.ts)} x2={x(hover.ts)} y1={PAD.t} y2={H - PAD.b} stroke="#334155" strokeWidth="1" />
              <circle cx={x(hover.ts)} cy={y(hover.liters)} r="4" fill="#1d4ed8" stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute top-0 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-sm text-white"
            style={{
              left: `${(x(hover.ts) / W) * 100}%`,
              transform: `translateX(${x(hover.ts) > W / 2 ? "-105%" : "5%"})`,
            }}
          >
            {fmtWeekday(hover.ts)} {fmtTime(hover.ts)} · {fmtInt(hover.liters)} L
          </div>
        )}
      </div>
      <p className="text-sm text-slate-600">
        <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-green-200 align-middle" />
        Franja verde: entró agua.
      </p>
    </section>
  );
}
