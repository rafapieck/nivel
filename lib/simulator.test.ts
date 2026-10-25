import { describe, expect, it } from "vitest";
import { SCENARIOS, simulateReadings } from "./simulator";
import { distanceToLiters } from "./calibration";

const cal = { capacityL: 1100, dFullCm: 25, dEmptyCm: 125 };
const end = new Date(2026, 9, 25, 18, 0).getTime();

describe("simulator", () => {
  it("produces 10-minute readings inside the calibrated range", () => {
    for (const s of SCENARIOS) {
      const r = simulateReadings(s, cal, { end });
      expect(r[1].ts - r[0].ts).toBe(10 * 60 * 1000);
      expect(r.every((x) => !distanceToLiters(x.distanceCm, cal).outOfRange)).toBe(true);
    }
  });

  it("covers 72 h, or 4 weeks for history4w", () => {
    expect(simulateReadings("normal", cal, { end })).toHaveLength(72 * 6 + 1);
    expect(simulateReadings("history4w", cal, { end })).toHaveLength(28 * 24 * 6 + 1);
  });

  it("is deterministic for a seed", () => {
    expect(simulateReadings("tandeo", cal, { end, seed: 7 })).toEqual(
      simulateReadings("tandeo", cal, { end, seed: 7 }),
    );
  });
});
