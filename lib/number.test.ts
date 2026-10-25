import { describe, expect, it } from "vitest";
import { calibrationInput } from "./calibration";
import { parseNumberMx } from "./number";
import { liters, priceMxn } from "./pipaSchemas";

// Mechanical-pass bug: "1,100" (the form's own hint) was parsed as 1.1.
describe("parseNumberMx", () => {
  it("reads commas as thousands separators, as written in Mexico", () => {
    expect(parseNumberMx("1,100")).toBe(1100);
    expect(parseNumberMx("10,000")).toBe(10000);
    expect(parseNumberMx("1,200.50")).toBe(1200.5);
    expect(parseNumberMx("$1,200")).toBe(1200);
    expect(parseNumberMx(" 20 000 ")).toBe(20000);
  });

  it("still accepts a lone decimal comma like 12,5", () => {
    expect(parseNumberMx("12,5")).toBe(12.5);
    expect(parseNumberMx("45,25")).toBe(45.25);
    expect(parseNumberMx("45.5")).toBe(45.5);
  });

  it("returns NaN for empty, ambiguous or non-numeric input", () => {
    for (const s of ["", "  ", "abc", "1.200,50", "1,2,3", "0x10", "1e3", "--5"]) {
      expect(parseNumberMx(s)).toBeNaN();
    }
  });

  it("the calibration example 1,100 L becomes a 1,100 L tank, not 1.1 L", () => {
    const parsed = calibrationInput.parse({ type: "tinaco", capacityL: parseNumberMx("1,100"), dFullCm: 25, dEmptyCm: 125 });
    expect(parsed.capacityL).toBe(1100);
  });

  it("order inputs keep their real size", () => {
    expect(liters.parse(parseNumberMx("10,000"))).toBe(10000);
    expect(priceMxn.parse(parseNumberMx("1,200"))).toBe(1200);
  });
});
