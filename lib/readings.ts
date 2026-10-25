import { z } from "zod";
import { distanceCm } from "./calibration";

export const READING_SOURCES = ["simulated", "csv", "manual"] as const;
export type ReadingSource = (typeof READING_SOURCES)[number];

export const SOURCE_LABEL: Record<ReadingSource, string> = {
  simulated: "Simulador",
  csv: "CSV",
  manual: "Manual",
};

const MIN_TS = Date.UTC(2000, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

export const timestampMs = z
  .number({ error: "Fecha inválida" })
  .int("Fecha inválida")
  .min(MIN_TS, "La fecha es demasiado antigua")
  .refine((ts) => ts <= Date.now() + DAY_MS, "La fecha está en el futuro");

export const readingPoint = z.object({ ts: timestampMs, distanceCm }).strict();
export type ReadingPoint = z.infer<typeof readingPoint>;

/** A distance reading as stored on the phone. Raw readings never leave the device. */
export type Reading = ReadingPoint & {
  id: number;
  source: ReadingSource;
  /** Calibration snapshot in effect when the reading was stored. */
  calibrationId: number;
};
