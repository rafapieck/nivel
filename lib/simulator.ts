import { levelToDistance, type CalibrationInput } from "./calibration";
import type { ReadingPoint } from "./readings";

// Simulated ESP32 ultrasonic feed. Everything it produces is labeled "DATOS DE PRUEBA — NO SON DE TU TINACO" (yellow).

export const SCENARIOS = ["normal", "tandeo", "leak", "night_refill", "flat", "history4w"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABEL: Record<Scenario, string> = {
  normal: "Normal (72 h, sin entradas de agua)",
  tandeo: "Tandeo (72 h, 2 entradas de agua)",
  leak: "Fuga (bajadas de noche)",
  night_refill: "Llenado nocturno",
  flat: "Sin uso (nivel plano)",
  history4w: "Historial de 4 semanas",
};

export const STEP_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Share of daily use per hour of day: quiet at night, peaks morning and evening.
const HOURLY_USE = [
  0.005, 0.005, 0.005, 0.005, 0.005, 0.005, 0.09, 0.09, 0.09, 0.09, 0.035, 0.035, 0.035, 0.035,
  0.035, 0.035, 0.035, 0.035, 0.07, 0.07, 0.07, 0.07, 0.07, 0.02,
];
const HOURLY_SUM = HOURLY_USE.reduce((a, b) => a + b, 0);

// Keep the simulated level inside the calibrated range so noise doesn't flag readings.
const MIN_LEVEL = 0.03;
const MAX_LEVEL = 0.97;

type WaterIn = { start: number; minutes: number; amount: number };
type Plan = {
  days: number;
  startLevel: number;
  /** Fraction of capacity used per day. */
  dailyUse: number;
  /** Extra drop (fraction/h) between 01:00 and 05:30. */
  nightDrop: number;
  events: WaterIn[];
};

/** Deterministic PRNG so scenarios and tests are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function localMidnight(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function at(dayMidnight: number, dayOffset: number, hour: number, minute = 0) {
  const d = new Date(dayMidnight);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function plan(scenario: Scenario, end: number, rand: () => number): Plan {
  const today = localMidnight(end);
  switch (scenario) {
    case "normal":
      return { days: 3, startLevel: 0.85, dailyUse: 0.2, nightDrop: 0, events: [] };
    case "flat":
      return { days: 3, startLevel: 0.6, dailyUse: 0, nightDrop: 0, events: [] };
    case "tandeo":
      return {
        days: 3,
        startLevel: 0.55,
        dailyUse: 0.22,
        nightDrop: 0,
        events: [
          { start: at(today, -2, 14, 10), minutes: 150, amount: 0.4 },
          { start: at(today, -1, 9, 40), minutes: 120, amount: 0.35 },
        ],
      };
    case "leak":
      return {
        days: 3,
        startLevel: 0.8,
        dailyUse: 0.18,
        nightDrop: 0.015,
        events: [{ start: at(today, -1, 15, 0), minutes: 120, amount: 0.45 }],
      };
    case "night_refill":
      return {
        days: 3,
        startLevel: 0.5,
        dailyUse: 0.2,
        nightDrop: 0.015,
        events: [-3, -2, -1, 0].map((d) => ({ start: at(today, d, 2, 30), minutes: 90, amount: 0.25 })),
      };
    case "history4w": {
      // Tandeo on Tuesdays and Fridays in the afternoon, give or take an hour.
      const start = end - 28 * DAY_MS;
      const events: WaterIn[] = [];
      for (let d = -28; d <= 0; d++) {
        const day = at(today, d, 0);
        const weekday = new Date(day).getDay();
        if (weekday !== 2 && weekday !== 5) continue;
        const s = at(today, d, 13, Math.floor(rand() * 60));
        if (s > start && s + 150 * 60 * 1000 < end) events.push({ start: s, minutes: 150, amount: 0.6 });
      }
      return { days: 28, startLevel: 0.6, dailyUse: 0.2, nightDrop: 0, events };
    }
  }
}

/** True level (0–1) every 10 minutes, before sensor noise. */
export function simulateLevels(
  scenario: Scenario,
  opts: { end?: number; seed?: number } = {},
): { ts: number; level: number }[] {
  const end = Math.floor((opts.end ?? Date.now()) / STEP_MS) * STEP_MS;
  const rand = mulberry32(opts.seed ?? 42);
  const p = plan(scenario, end, rand);
  const start = end - p.days * DAY_MS;

  const out: { ts: number; level: number }[] = [];
  let level = p.startLevel;
  for (let ts = start; ts <= end; ts += STEP_MS) {
    out.push({ ts, level });
    const d = new Date(ts);
    const hour = d.getHours() + d.getMinutes() / 60;
    level -= (p.dailyUse * HOURLY_USE[d.getHours()]) / HOURLY_SUM / 6;
    if (hour >= 1 && hour < 5.5) level -= p.nightDrop / 6;
    for (const e of p.events) {
      if (ts >= e.start && ts < e.start + e.minutes * 60 * 1000) {
        level += e.amount / (e.minutes / 10);
      }
    }
    level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
  }
  return out;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Readings every 10 min: each one is the median of 5 pings with ±1 cm noise. */
export function simulateReadings(
  scenario: Scenario,
  cal: Pick<CalibrationInput, "dFullCm" | "dEmptyCm">,
  opts: { end?: number; seed?: number } = {},
): ReadingPoint[] {
  const rand = mulberry32((opts.seed ?? 42) + 1);
  return simulateLevels(scenario, opts).map(({ ts, level }) => {
    const d = levelToDistance(level, cal);
    const pings = Array.from({ length: 5 }, () => d + (rand() * 2 - 1));
    return { ts, distanceCm: Math.round(median(pings) * 10) / 10 };
  });
}
