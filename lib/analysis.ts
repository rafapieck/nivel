// Tank analysis. Pure functions over time-ordered samples; everything runs on the phone.

export type Sample = { ts: number; liters: number };
export type WaterInSource = "red" | "pipa" | "bomba";
export type WaterInEvent = { start: number; end: number; litersIn: number };

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Median of 3 neighbours: ignores a single-reading jump with no support. */
export function smooth(samples: Sample[]): Sample[] {
  return samples.map((s, i) => {
    if (i === 0 || i === samples.length - 1) return s;
    const v = [samples[i - 1].liters, s.liters, samples[i + 1].liters].sort((a, b) => a - b)[1];
    return { ts: s.ts, liters: v };
  });
}

/**
 * Water-in: a rise of ≥ 3% of capacity that is still there ≥ 30 min after it ends.
 * A rising run is consecutive steps up by > 0.5% of capacity, tolerating one flat step.
 */
export function detectWaterIn(samples: Sample[], capacityL: number): WaterInEvent[] {
  const s = smooth(samples);
  const minStep = 0.005 * capacityL;
  const minRise = 0.03 * capacityL;
  const rising = (k: number) => k + 1 < s.length && s[k + 1].liters - s[k].liters > minStep;
  const events: WaterInEvent[] = [];

  let i = 0;
  while (i < s.length - 1) {
    if (!rising(i)) {
      i++;
      continue;
    }
    const a = i;
    let b = i + 1;
    while (rising(b) || (rising(b + 1) && s[b + 1].liters >= s[b].liters - minStep)) b++;
    // b may sit on the tolerated flat step's start; extend to the run's top.
    while (b + 1 < s.length && rising(b)) b++;

    const base = s[a].liters;
    const rise = s[b].liters - base;
    if (rise >= minRise && sustained(s, b, base + minRise)) {
      events.push({ start: s[a].ts, end: s[b].ts, litersIn: rise });
    }
    i = b;
  }
  return events;
}

function sustained(s: Sample[], b: number, floor: number): boolean {
  const until = s[b].ts + 30 * MINUTE_MS;
  for (let k = b + 1; k < s.length; k++) {
    if (s[k].liters < floor) return false;
    if (s[k].ts >= until) return true;
  }
  return false; // not enough data after the rise yet
}

/** Splits samples into runs that don't touch any water-in event. */
export function consumptionSegments(samples: Sample[], events: WaterInEvent[]): Sample[][] {
  const segments: Sample[][] = [];
  let current: Sample[] = [];
  for (const p of samples) {
    if (events.some((e) => p.ts >= e.start && p.ts <= e.end)) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

export type RateFit = { litersPerDay: number; residualStdL: number; n: number };

/**
 * Least-squares consumption rate over the non-water-in segments of the last `windowH` hours.
 * One common slope, one intercept per segment. Positive = the tank is emptying.
 */
export function consumptionRate(
  samples: Sample[],
  events: WaterInEvent[],
  opts: { now?: number; windowH?: number } = {},
): RateFit | null {
  const now = opts.now ?? samples.at(-1)?.ts ?? 0;
  const from = now - (opts.windowH ?? 48) * HOUR_MS;
  const inWindow = samples.filter((p) => p.ts >= from && p.ts <= now);
  const segments = consumptionSegments(smooth(inWindow), events).filter((g) => g.length >= 3);

  let sxy = 0;
  let sxx = 0;
  let n = 0;
  const stats = segments.map((g) => {
    const tm = g.reduce((a, p) => a + p.ts, 0) / g.length;
    const ym = g.reduce((a, p) => a + p.liters, 0) / g.length;
    for (const p of g) {
      sxy += (p.ts - tm) * (p.liters - ym);
      sxx += (p.ts - tm) ** 2;
    }
    n += g.length;
    return { g, tm, ym };
  });
  if (n < 6 || sxx === 0) return null;

  const slope = sxy / sxx; // L per ms
  let ssr = 0;
  for (const { g, tm, ym } of stats) {
    for (const p of g) ssr += (p.liters - (ym + slope * (p.ts - tm))) ** 2;
  }
  const dof = Math.max(1, n - segments.length - 1);
  return { litersPerDay: -slope * DAY_MS, residualStdL: Math.sqrt(ssr / dof), n };
}

/** Simple baseline: total liters out ÷ days observed (water-in periods excluded). */
export function baselineRate(samples: Sample[], events: WaterInEvent[]): number | null {
  let out = 0;
  let ms = 0;
  for (const g of consumptionSegments(smooth(samples), events)) {
    if (g.length < 2) continue;
    out += Math.max(0, g[0].liters - g.at(-1)!.liters);
    ms += g.at(-1)!.ts - g[0].ts;
  }
  return ms >= 6 * HOUR_MS ? (out / ms) * DAY_MS : null;
}

export type HeldOut = {
  mlMaeL: number;
  baselineMaeL: number;
  winner: "ml" | "baseline";
};

/**
 * Fits both rates on everything except the last `holdoutH` hours, then predicts the held-out
 * consumption segments from each segment's first point. Ties go to the baseline.
 */
export function heldOutError(
  samples: Sample[],
  events: WaterInEvent[],
  opts: { holdoutH?: number } = {},
): HeldOut | null {
  if (samples.length < 2) return null;
  const split = samples.at(-1)!.ts - (opts.holdoutH ?? 24) * HOUR_MS;
  const train = samples.filter((p) => p.ts < split);
  const test = samples.filter((p) => p.ts >= split);
  const trainEvents = events.filter((e) => e.end < split);

  const ml = consumptionRate(train, trainEvents, { now: split });
  const base = baselineRate(train, trainEvents);
  if (!ml || base === null) return null;

  let mlErr = 0;
  let baseErr = 0;
  let n = 0;
  for (const g of consumptionSegments(smooth(test), events)) {
    for (let k = 1; k < g.length; k++) {
      const days = (g[k].ts - g[0].ts) / DAY_MS;
      mlErr += Math.abs(g[0].liters - ml.litersPerDay * days - g[k].liters);
      baseErr += Math.abs(g[0].liters - base * days - g[k].liters);
      n++;
    }
  }
  if (n === 0) return null;
  const mlMaeL = mlErr / n;
  const baselineMaeL = baseErr / n;
  return { mlMaeL, baselineMaeL, winner: mlMaeL < baselineMaeL ? "ml" : "baseline" };
}

const floorHalf = (x: number) => Math.floor(x * 2) / 2;
const ceilHalf = (x: number) => Math.ceil(x * 2) / 2;

/**
 * Days until empty as a range, never a single number, rounded to half days.
 * Widened by ±1 residual std on the level and by the held-out relative error on the rate.
 * Null when the tank isn't emptying (rate under 1 L/day).
 */
export function daysRemaining(
  liters: number,
  litersPerDay: number,
  opts: { residualStdL?: number; relError?: number } = {},
): { min: number; max: number } | null {
  if (!(litersPerDay >= 1)) return null;
  const e = Math.min(0.9, Math.max(0.05, opts.relError ?? 0.2));
  const sd = opts.residualStdL ?? 0;
  const min = floorHalf(Math.max(0, liters - sd) / (litersPerDay * (1 + e)));
  let max = ceilHalf((liters + sd) / (litersPerDay * (1 - e)));
  if (max <= min) max = min + 0.5;
  return { min, max };
}

export type NightDrop = { fires: boolean; nights: number[] };

/**
 * Night drop: the level falls > 1% of capacity per hour across 02:00–05:00 (local time),
 * with no water-in event in the window, on ≥ 2 nights. `nights` holds each window's start.
 */
export function nightDrop(
  samples: Sample[],
  capacityL: number,
  events: WaterInEvent[],
): NightDrop {
  const nights: number[] = [];
  if (samples.length === 0) return { fires: false, nights };
  const s = smooth(samples);

  const day = new Date(s[0].ts);
  day.setHours(0, 0, 0, 0);
  for (; day.getTime() <= s.at(-1)!.ts; day.setDate(day.getDate() + 1)) {
    const wStart = new Date(day).setHours(2, 0, 0, 0);
    const wEnd = new Date(day).setHours(5, 0, 0, 0);
    if (events.some((e) => e.start <= wEnd && e.end >= wStart)) continue;
    const pts = s.filter((p) => p.ts >= wStart && p.ts <= wEnd);
    if (pts.length < 6 || pts[0].ts > wStart + 20 * MINUTE_MS || pts.at(-1)!.ts < wEnd - 20 * MINUTE_MS) {
      continue; // window not covered well enough to judge
    }
    const tm = pts.reduce((a, p) => a + p.ts, 0) / pts.length;
    const ym = pts.reduce((a, p) => a + p.liters, 0) / pts.length;
    let sxy = 0;
    let sxx = 0;
    for (const p of pts) {
      sxy += (p.ts - tm) * (p.liters - ym);
      sxx += (p.ts - tm) ** 2;
    }
    const dropPerHour = (-sxy / sxx) * HOUR_MS;
    if (dropPerHour > 0.01 * capacityL) nights.push(wStart);
  }
  return { fires: nights.length >= 2, nights };
}

export type ArrivalPattern = { byWeekday: number[]; total: number; weeks: number };

function weekKey(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

/** Weekday histogram of arrivals — a pattern, not a prediction. Null unless ≥ 6 events over ≥ 3 weeks. */
export function arrivalPattern(events: WaterInEvent[]): ArrivalPattern | null {
  if (events.length < 6) return null;
  const weeks = new Set(events.map((e) => weekKey(e.start))).size;
  const span = events.at(-1)!.start - events[0].start;
  if (weeks < 3 || span < 14 * DAY_MS) return null;
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const e of events) byWeekday[new Date(e.start).getDay()]++;
  return { byWeekday, total: events.length, weeks };
}

/** Observed delivery corrected for water used while filling. Null when nothing was observed. */
export function estimatedLiters(
  observed: number | null,
  litersPerDay: number,
  fillMinutes: number,
): number | null {
  if (observed === null) return null;
  return observed + (litersPerDay * fillMinutes) / (24 * 60);
}

export type TankAnalysis = {
  current: Sample | null;
  events: WaterInEvent[];
  ml: RateFit | null;
  baseline: number | null;
  heldOut: HeldOut | null;
  /** Which estimate the dashboard leads with: the held-out winner (baseline when untested). */
  lead: "ml" | "baseline";
  days: { min: number; max: number } | null;
  baselineDays: number | null;
  nightDrop: NightDrop;
  arrivals: ArrivalPattern | null;
};

export function analyzeTank(samples: Sample[], capacityL: number): TankAnalysis {
  const events = detectWaterIn(samples, capacityL);
  const ml = consumptionRate(samples, events);
  const baseline = baselineRate(samples, events);
  const heldOut = heldOutError(samples, events);
  const current = smooth(samples).at(-1) ?? null;

  const lead = heldOut?.winner === "ml" && ml ? "ml" : "baseline";
  // Below 0.5% of capacity per day the tank isn't really emptying; it's sensor noise.
  const minRate = 0.005 * capacityL;
  const leadRate = lead === "ml" ? ml?.litersPerDay : baseline;
  const rate = leadRate != null && leadRate >= minRate ? leadRate : null;
  const mae = heldOut ? (lead === "ml" ? heldOut.mlMaeL : heldOut.baselineMaeL) : undefined;
  const days =
    current && rate != null
      ? daysRemaining(current.liters, rate, {
          residualStdL: ml?.residualStdL,
          relError: mae !== undefined ? mae / rate : undefined,
        })
      : null;
  const baselineDays =
    current && baseline != null && baseline >= minRate ? current.liters / baseline : null;

  return {
    current,
    events,
    ml,
    baseline,
    heldOut,
    lead,
    days,
    baselineDays,
    nightDrop: nightDrop(samples, capacityL, events),
    arrivals: arrivalPattern(events),
  };
}
