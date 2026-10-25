import { z } from "zod";

export const TANK_TYPES = ["tinaco", "cisterna"] as const;
export type TankType = (typeof TANK_TYPES)[number];

export const TANK_TYPE_LABEL: Record<TankType, string> = {
  tinaco: "Tinaco",
  cisterna: "Cisterna compartida",
};

export const distanceCm = z
  .number({ error: "Escribe la distancia en cm" })
  .min(0, "La distancia debe estar entre 0 y 400 cm")
  .max(400, "La distancia debe estar entre 0 y 400 cm");

export const calibrationInput = z
  .object({
    type: z.enum(TANK_TYPES, { error: "Elige tinaco o cisterna" }),
    capacityL: z
      .number({ error: "Escribe la capacidad en litros" })
      .min(1, "La capacidad debe estar entre 1 y 20,000 L")
      .max(20000, "La capacidad debe estar entre 1 y 20,000 L"),
    dFullCm: distanceCm,
    dEmptyCm: distanceCm,
  })
  .strict()
  .refine((c) => c.dEmptyCm - c.dFullCm >= 5, {
    path: ["dEmptyCm"],
    error: "La distancia vacío debe ser al menos 5 cm mayor que la de lleno",
  });

export type CalibrationInput = z.infer<typeof calibrationInput>;

/** A calibration snapshot as stored on the phone. Recalibrating adds a new one. */
export type Calibration = CalibrationInput & { id: number; createdAt: number };

/** Common waterproof ultrasonic modules can't measure closer than ~20–25 cm. */
export const SENSOR_BLIND_ZONE_CM = 20;

export type LitersResult = {
  liters: number;
  /** 0–1 after clamping. */
  level: number;
  /** True when the distance fell outside d_full..d_empty and was clamped. */
  outOfRange: boolean;
};

/**
 * Sensor mounted at the top looking down; assumes a vertical cylinder.
 * level = (d_empty − d) / (d_empty − d_full), clamped to 0–1 and flagged if clamped.
 */
export function distanceToLiters(
  d: number,
  cal: Pick<CalibrationInput, "capacityL" | "dFullCm" | "dEmptyCm">,
): LitersResult {
  const raw = (cal.dEmptyCm - d) / (cal.dEmptyCm - cal.dFullCm);
  const level = Math.min(1, Math.max(0, raw));
  return { liters: level * cal.capacityL, level, outOfRange: raw < 0 || raw > 1 };
}

/** Inverse of distanceToLiters, used by the simulator. */
export function levelToDistance(
  level: number,
  cal: Pick<CalibrationInput, "dFullCm" | "dEmptyCm">,
): number {
  return cal.dEmptyCm - level * (cal.dEmptyCm - cal.dFullCm);
}
