import { analyzeTank, type Sample, type TankAnalysis } from "./analysis";
import { distanceToLiters, type Calibration } from "./calibration";
import type { Reading, ReadingSource } from "./readings";

export type TankData = {
  cal: Calibration;
  readings: Reading[];
  samples: Sample[];
  /** Readings outside the calibrated range: flagged and left out of the analysis. */
  outOfRange: number;
  sources: Set<ReadingSource>;
  analysis: TankAnalysis;
};

/**
 * Converts each reading with the calibration it was stored under (falling back to the
 * current one) and runs the analysis against the current capacity.
 */
export function buildTankData(cals: Calibration[], readings: Reading[]): TankData | null {
  const cal = cals[0];
  if (!cal) return null;
  const byId = new Map(cals.map((c) => [c.id, c]));
  const samples: Sample[] = [];
  let outOfRange = 0;
  for (const r of readings) {
    const res = distanceToLiters(r.distanceCm, byId.get(r.calibrationId) ?? cal);
    if (res.outOfRange) outOfRange++;
    else samples.push({ ts: r.ts, liters: res.liters });
  }
  return {
    cal,
    readings,
    samples,
    outOfRange,
    sources: new Set(readings.map((r) => r.source)),
    analysis: analyzeTank(samples, cal.capacityL),
  };
}
