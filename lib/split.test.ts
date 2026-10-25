import { describe, expect, it } from "vitest";
import { splitCost } from "./split";

const sum = (xs: { shareMxn: number }[]) => Math.round(xs.reduce((a, x) => a + x.shareMxn, 0) * 100) / 100;

// Packet test 7
describe("splitCost", () => {
  it("sums exactly to the quoted price, with the remainder on the coordinator line", () => {
    const lines = splitCost(
      1000,
      [
        { memberId: "coord", liters: 3000 },
        { memberId: "b", liters: 3000 },
        { memberId: "offline", liters: 3000 }, // offline member added by the coordinator
      ],
      "coord",
    );
    expect(sum(lines)).toBe(1000);
    expect(lines).toEqual([
      { memberId: "coord", shareMxn: 334, roundingMxn: 1 },
      { memberId: "b", shareMxn: 333, roundingMxn: 0 },
      { memberId: "offline", shareMxn: 333, roundingMxn: 0 },
    ]);
  });

  it("matches the server on uneven liters and a price with cents", () => {
    const lines = splitCost(
      1234.5,
      [
        { memberId: "coord", liters: 3000 },
        { memberId: "b", liters: 1000 },
        { memberId: "offline", liters: 3000 },
      ],
      "coord",
    );
    expect(lines.map((l) => l.shareMxn)).toEqual([529.5, 176, 529]);
    expect(lines[0].roundingMxn).toBe(0.5);
    expect(sum(lines)).toBe(1234.5);
  });

  it("puts the remainder on the largest request when the coordinator asked for no water", () => {
    const lines = splitCost(
      1000,
      [
        { memberId: "a", liters: 1000 },
        { memberId: "b", liters: 2000 },
      ],
      "coord",
    );
    expect(sum(lines)).toBe(1000);
    expect(lines.find((l) => l.roundingMxn > 0)?.memberId).toBe("b");
  });

  it("holds for many random splits", () => {
    for (let i = 1; i < 200; i++) {
      const reqs = Array.from({ length: 1 + (i % 7) }, (_, k) => ({
        memberId: `m${k}`,
        liters: 1 + ((i * 7919 + k * 104729) % 20000),
      }));
      const price = ((i * 3571) % 5000000) / 100;
      expect(sum(splitCost(price, reqs, "m0"))).toBeCloseTo(price, 2);
    }
  });
});
