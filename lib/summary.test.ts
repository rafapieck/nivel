import { describe, expect, it } from "vitest";
import { MINUTE_MS, type Sample } from "./analysis";
import type { Calibration } from "./calibration";
import { GAP_TOLERANCE, buildTankSummary, quotedObservedGap, tankSummaryPayload } from "./summary";

const cal: Calibration = {
  id: 1,
  type: "tinaco",
  capacityL: 1100,
  dFullCm: 25,
  dEmptyCm: 125,
  createdAt: Date.UTC(2026, 9, 20),
};
const t0 = Date.UTC(2026, 9, 24, 14, 0);
// 300 L before; fill 60 min adds 500 L; flat otherwise.
const samples: Sample[] = Array.from({ length: 48 }, (_, i) => {
  const ts = t0 - 4 * 60 * MINUTE_MS + i * 10 * MINUTE_MS;
  const into = (ts - t0) / (60 * MINUTE_MS);
  return { ts, liters: into <= 0 ? 300 : into >= 1 ? 800 : 300 + 500 * into };
});

describe("buildTankSummary", () => {
  it("takes before/after around the fill and adds the use during it", () => {
    const r = buildTankSummary(samples, cal, t0, 60, 240);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.before_l).toBe(300);
    expect(r.draft.after_l).toBe(800);
    expect(r.draft.delta_l).toBe(500);
    expect(r.draft.use_during_fill_l).toBe(10);
    expect(Object.keys(r.draft.calibration_snapshot).sort()).toEqual([
      "calibrated_at",
      "capacity_l",
      "d_empty_cm",
      "d_full_cm",
    ]);
  });

  it("refuses when there are no readings around the delivery", () => {
    expect(buildTankSummary(samples, cal, t0 + 10 * 60 * MINUTE_MS, 60, 240)).toEqual({ ok: false, reason: "no_before" });
    expect(buildTankSummary(samples.slice(0, 26), cal, t0, 60, 240)).toEqual({ ok: false, reason: "no_after" });
  });
});

// Packet test 13 (client side; the server has a matching check constraint)
describe("tankSummaryPayload", () => {
  const r = buildTankSummary(samples, cal, t0, 60, 240);
  if (!r.ok) throw new Error("fixture");
  const payload = {
    ...r.draft,
    order_id: "22222222-2222-4222-8222-222222222222",
    member_id: "33333333-3333-4333-8333-333333333333",
  };

  it("accepts the summary built on the phone", () => {
    expect(tankSummaryPayload.safeParse(payload).success).toBe(true);
  });

  it("rejects an extra readings field", () => {
    expect(tankSummaryPayload.safeParse({ ...payload, readings: [1, 2, 3] }).success).toBe(false);
  });

  it("rejects extra keys inside the calibration snapshot", () => {
    const snap = { ...payload.calibration_snapshot, series: [1] };
    expect(tankSummaryPayload.safeParse({ ...payload, calibration_snapshot: snap }).success).toBe(false);
  });

  it("rejects an inconsistent delta", () => {
    expect(tankSummaryPayload.safeParse({ ...payload, delta_l: 900 }).success).toBe(false);
  });
});

describe("quotedObservedGap", () => {
  it("flags a 20% gap and not a 10% one", () => {
    expect(quotedObservedGap(10000, 8000)! > GAP_TOLERANCE).toBe(true);
    expect(quotedObservedGap(10000, 9000)! > GAP_TOLERANCE).toBe(false);
    expect(quotedObservedGap(10000, null)).toBeNull();
  });
});
