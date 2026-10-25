import { describe, expect, it } from "vitest";
import { costInputs, costTotals } from "./cost";

describe("costTotals", () => {
  it("is all empty with empty inputs", () => {
    expect(costTotals({})).toEqual({
      upfrontMxn: null,
      firstYearMxn: null,
      nivelMinutesMonth: null,
      whatsappMinutesMonth: null,
    });
  });

  it("adds up totals once their inputs exist", () => {
    expect(
      costTotals({
        sensorMxn: 400,
        installMxn: 150,
        supportMxnMonth: 20,
        nivelMinutesPerOrder: 10,
        ordersPerMonth: 3,
        whatsappMinutesPerOrder: 45,
      }),
    ).toEqual({ upfrontMxn: 550, firstYearMxn: 790, nivelMinutesMonth: 30, whatsappMinutesMonth: 135 });
  });

  it("keeps a total empty while one of its inputs is missing", () => {
    expect(costTotals({ sensorMxn: 400 }).upfrontMxn).toBeNull();
    expect(costTotals({ nivelMinutesPerOrder: 10 }).nivelMinutesMonth).toBeNull();
  });
});

describe("costInputs", () => {
  it("rejects negatives and out-of-range values", () => {
    expect(costInputs.safeParse({ sensorMxn: -1 }).success).toBe(false);
    expect(costInputs.safeParse({ ordersPerMonth: 1.5 }).success).toBe(false);
    expect(costInputs.safeParse({ nivelMinutesPerOrder: 2000 }).success).toBe(false);
    expect(costInputs.safeParse({ roi: 3 }).success).toBe(false);
  });
});
