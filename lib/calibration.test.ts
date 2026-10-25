import { describe, expect, it } from "vitest";
import { calibrationInput, distanceToLiters } from "./calibration";

const cal = { capacityL: 1100, dFullCm: 25, dEmptyCm: 125 };

// Packet test 1
describe("distanceToLiters", () => {
  it("d = d_full gives 100%", () => {
    expect(distanceToLiters(25, cal)).toEqual({ liters: 1100, level: 1, outOfRange: false });
  });

  it("d = d_empty gives 0%", () => {
    expect(distanceToLiters(125, cal)).toEqual({ liters: 0, level: 0, outOfRange: false });
  });

  it("is linear in between", () => {
    expect(distanceToLiters(75, cal).liters).toBeCloseTo(550);
  });

  it("clamps and flags d < d_full", () => {
    expect(distanceToLiters(20, cal)).toEqual({ liters: 1100, level: 1, outOfRange: true });
  });

  it("clamps and flags d > d_empty", () => {
    expect(distanceToLiters(130, cal)).toEqual({ liters: 0, level: 0, outOfRange: true });
  });
});

describe("calibrationInput", () => {
  const ok = { type: "tinaco", capacityL: 1100, dFullCm: 25, dEmptyCm: 125 };

  it("accepts a valid calibration", () => {
    expect(calibrationInput.safeParse(ok).success).toBe(true);
  });

  it("rejects out-of-range values and inverted distances", () => {
    expect(calibrationInput.safeParse({ ...ok, capacityL: 0 }).success).toBe(false);
    expect(calibrationInput.safeParse({ ...ok, capacityL: 20001 }).success).toBe(false);
    expect(calibrationInput.safeParse({ ...ok, dEmptyCm: 401 }).success).toBe(false);
    expect(calibrationInput.safeParse({ ...ok, dFullCm: 130 }).success).toBe(false);
    expect(calibrationInput.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
});
