import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  analyzeTank,
  arrivalPattern,
  consumptionRate,
  daysRemaining,
  detectWaterIn,
  estimatedLiters,
  heldOutError,
  nightDrop,
  type Sample,
  type WaterInEvent,
} from "./analysis";
import { distanceToLiters } from "./calibration";
import { simulateReadings, type Scenario } from "./simulator";

const cal = { capacityL: 1100, dFullCm: 25, dEmptyCm: 125 };
// Several end times and seeds so results don't hinge on one lucky run.
const ENDS = [0, 3, 7, 12, 18, 23].map((h) => new Date(2026, 9, 25, h, 20).getTime());
const SEEDS = [1, 42, 99];

function samples(scenario: Scenario, end: number, seed: number): Sample[] {
  return simulateReadings(scenario, cal, { end, seed }).map((r) => ({
    ts: r.ts,
    liters: distanceToLiters(r.distanceCm, cal).liters,
  }));
}

function eachRun(fn: (end: number, seed: number) => void) {
  for (const end of ENDS) for (const seed of SEEDS) fn(end, seed);
}

// Packet test 2
describe("detectWaterIn", () => {
  it("finds the 2 events in tandeo", () => {
    eachRun((end, seed) => {
      const ev = detectWaterIn(samples("tandeo", end, seed), cal.capacityL);
      expect(ev).toHaveLength(2);
      for (const e of ev) expect(e.litersIn).toBeGreaterThan(300);
    });
  });

  it("finds none in flat or normal", () => {
    eachRun((end, seed) => {
      expect(detectWaterIn(samples("flat", end, seed), cal.capacityL)).toEqual([]);
      expect(detectWaterIn(samples("normal", end, seed), cal.capacityL)).toEqual([]);
    });
  });

  it("ignores a single-reading spike", () => {
    const flat: Sample[] = Array.from({ length: 30 }, (_, i) => ({ ts: i * 600000, liters: 500 }));
    flat[10] = { ts: flat[10].ts, liters: 900 };
    expect(detectWaterIn(flat, 1100)).toEqual([]);
  });

  it("requires the rise to be sustained for 30 min", () => {
    const pts: Sample[] = Array.from({ length: 30 }, (_, i) => ({
      ts: i * 600000,
      liters: i >= 10 && i < 13 ? 500 + (i - 9) * 40 : 500,
    }));
    expect(detectWaterIn(pts, 1100)).toEqual([]);
  });
});

describe("analyzeTank", () => {
  it("gives no days-remaining estimate for a flat tank", () => {
    const a = analyzeTank(samples("flat", ENDS[3], 42), cal.capacityL);
    expect(a.days).toBeNull();
    expect(a.baselineDays).toBeNull();
  });
});

// Packet test 3
describe("consumptionRate", () => {
  it("recovers the slope of synthetic linear data within 2%", () => {
    const pts: Sample[] = Array.from({ length: 6 * 48 + 1 }, (_, i) => ({
      ts: i * 600000,
      liters: 1000 - (200 * i * 600000) / DAY_MS + ((i * 7919) % 11) / 5 - 1, // ±1 L jitter
    }));
    const fit = consumptionRate(pts, [])!;
    expect(Math.abs(fit.litersPerDay - 200) / 200).toBeLessThan(0.02);
  });

  it("ignores water-in segments", () => {
    const pts: Sample[] = Array.from({ length: 6 * 48 + 1 }, (_, i) => {
      const ts = i * 600000;
      const refill = i >= 100 ? 400 : 0;
      return { ts, liters: 600 + refill - (200 * ts) / DAY_MS };
    });
    const events: WaterInEvent[] = [{ start: 99 * 600000, end: 100 * 600000, litersIn: 400 }];
    expect(consumptionRate(pts, events)!.litersPerDay).toBeCloseTo(200, 0);
  });
});

// Packet test 4
describe("nightDrop", () => {
  const run = (s: Scenario, end: number, seed: number) => {
    const x = samples(s, end, seed);
    return nightDrop(x, cal.capacityL, detectWaterIn(x, cal.capacityL));
  };

  it("fires on leak", () => eachRun((end, seed) => expect(run("leak", end, seed).fires).toBe(true)));
  it("does not fire on normal", () =>
    eachRun((end, seed) => expect(run("normal", end, seed).fires).toBe(false)));
  it("does not fire on night_refill (water-in inside the window)", () =>
    eachRun((end, seed) => expect(run("night_refill", end, seed).fires).toBe(false)));
});

// Packet test 5
describe("held-out check", () => {
  it("computes MAE for ML and baseline and the dashboard leads with the winner", () => {
    eachRun((end, seed) => {
      for (const s of ["normal", "tandeo", "leak"] as const) {
        const x = samples(s, end, seed);
        const a = analyzeTank(x, cal.capacityL);
        const h = heldOutError(x, a.events)!;
        expect(Number.isFinite(h.mlMaeL)).toBe(true);
        expect(Number.isFinite(h.baselineMaeL)).toBe(true);
        expect(h.winner).toBe(h.mlMaeL < h.baselineMaeL ? "ml" : "baseline");
        expect(a.lead).toBe(h.winner);
      }
    });
  });

  it("leads with the baseline when the baseline wins", () => {
    // Steady 100 L/day for 3 days, then a burst of use in the last 48 h:
    // the regression chases the burst, the long-run baseline predicts the last day better.
    const pts: Sample[] = [];
    let l = 1000;
    for (let i = 0; i <= 6 * 24 * 4; i++) {
      const ts = i * 600000;
      const hoursLeft = 96 - i / 6;
      l -= (hoursLeft > 48 || hoursLeft <= 24 ? 100 : 300) / 144;
      pts.push({ ts, liters: l });
    }
    const a = analyzeTank(pts, 1100);
    expect(a.heldOut!.baselineMaeL).toBeLessThan(a.heldOut!.mlMaeL);
    expect(a.lead).toBe("baseline");
  });
});

describe("daysRemaining", () => {
  it("returns a half-day range around liters ÷ rate", () => {
    const r = daysRemaining(680, 200, { relError: 0.1 })!;
    expect(r.min).toBeLessThanOrEqual(3.4);
    expect(r.max).toBeGreaterThanOrEqual(3.4);
    expect((r.min * 2) % 1).toBe(0);
    expect((r.max * 2) % 1).toBe(0);
    expect(r.max).toBeGreaterThan(r.min);
  });

  it("is null when the tank isn't emptying", () => {
    expect(daysRemaining(680, 0)).toBeNull();
    expect(daysRemaining(680, -10)).toBeNull();
  });
});

// Packet test 6
describe("arrivalPattern", () => {
  const ev = (days: number[]): WaterInEvent[] =>
    days.map((d) => ({ start: d * DAY_MS, end: d * DAY_MS + 3600000, litersIn: 400 }));

  it("refuses with fewer than 6 arrivals", () => {
    expect(arrivalPattern(ev([0, 4, 7, 11, 14]))).toBeNull();
  });

  it("refuses with 6 arrivals packed into under 3 weeks", () => {
    expect(arrivalPattern(ev([0, 1, 2, 3, 4, 5]))).toBeNull();
  });

  it("returns a weekday histogram from the 4-week history", () => {
    const x = samples("history4w", ENDS[3], 42);
    const p = arrivalPattern(detectWaterIn(x, cal.capacityL))!;
    expect(p.total).toBeGreaterThanOrEqual(6);
    expect(p.byWeekday[2] + p.byWeekday[5]).toBe(p.total); // Tuesdays and Fridays
  });
});

// Packet test 8
describe("estimatedLiters", () => {
  it("adds water used during the fill", () => {
    expect(estimatedLiters(1000, 240, 60)).toBeCloseTo(1010);
  });

  it("is null when nothing was observed", () => {
    expect(estimatedLiters(null, 240, 60)).toBeNull();
  });
});
