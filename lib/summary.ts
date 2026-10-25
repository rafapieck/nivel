import { z } from "zod";
import { MINUTE_MS, smooth, type Sample } from "./analysis";
import type { Calibration } from "./calibration";

// Per-order tank summary, built on the phone from local readings. Only this object can ever
// leave the phone, and only if the owner taps "Compartir resumen". Never the time series.

const WINDOW_MS = 3 * 60 * MINUTE_MS;

const litersValue = z.number().min(0).max(20000);

export const calibrationSnapshot = z
  .object({
    capacity_l: z.number().min(1).max(20000),
    d_full_cm: z.number().min(0).max(400),
    d_empty_cm: z.number().min(0).max(400),
    calibrated_at: z.iso.datetime(),
  })
  .strict();

/** `.strict()` rejects any extra field, e.g. a smuggled `readings` array (packet test 13). */
export const tankSummaryPayload = z
  .object({
    order_id: z.uuid(),
    member_id: z.uuid(),
    tank_type: z.enum(["tinaco", "cisterna"]),
    before_l: litersValue,
    after_l: litersValue,
    delta_l: z.number().min(-20000).max(20000),
    calibration_snapshot: calibrationSnapshot,
    concurrent_use_note: z.string().max(200),
    use_during_fill_l: litersValue.nullable(),
  })
  .strict()
  .refine((s) => Math.abs(s.after_l - s.before_l - s.delta_l) < 0.05, {
    error: "delta_l debe ser after_l − before_l",
  });

export type TankSummaryPayload = z.infer<typeof tankSummaryPayload>;

export type SummaryDraft = Omit<TankSummaryPayload, "order_id" | "member_id">;
export type SummaryResult =
  | { ok: true; draft: SummaryDraft }
  | { ok: false; reason: "no_before" | "no_after" };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Before = last reading at or before the delivery (within 3 h); after = first reading at or after
 * the end of the fill (within 3 h). Water used during the fill is the owner's own consumption
 * rate × fill minutes, which is what "estimated" adds back on the server.
 */
export function buildTankSummary(
  samples: Sample[],
  cal: Calibration,
  deliveredAt: number,
  fillMinutes: number,
  litersPerDay: number | null,
): SummaryResult {
  const s = smooth(samples);
  const fillEnd = deliveredAt + fillMinutes * MINUTE_MS;
  const before = [...s].reverse().find((p) => p.ts <= deliveredAt && p.ts >= deliveredAt - WINDOW_MS);
  if (!before) return { ok: false, reason: "no_before" };
  const after = s.find((p) => p.ts >= fillEnd && p.ts <= fillEnd + WINDOW_MS);
  if (!after) return { ok: false, reason: "no_after" };

  const before_l = round1(before.liters);
  const after_l = round1(after.liters);
  const use =
    litersPerDay !== null && litersPerDay > 0 ? round1((litersPerDay * fillMinutes) / (24 * 60)) : null;

  return {
    ok: true,
    draft: {
      tank_type: cal.type,
      before_l,
      after_l,
      delta_l: round1(after_l - before_l),
      calibration_snapshot: {
        capacity_l: cal.capacityL,
        d_full_cm: cal.dFullCm,
        d_empty_cm: cal.dEmptyCm,
        calibrated_at: new Date(cal.createdAt).toISOString(),
      },
      concurrent_use_note:
        use !== null
          ? `Durante el llenado se pudo seguir usando agua: unos ${Math.round(use)} L (estimación ML).`
          : "No hay estimación del agua usada durante el llenado.",
      use_during_fill_l: use,
    },
  };
}

/** Relative gap between quoted and observed liters; null when nothing was observed. */
export function quotedObservedGap(quoted: number, observed: number | null): number | null {
  if (observed === null || quoted <= 0) return null;
  return (quoted - observed) / quoted;
}

export const GAP_TOLERANCE = 0.15;
