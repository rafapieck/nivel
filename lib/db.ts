import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Calibration, CalibrationInput } from "./calibration";

// Everything in this file stays on the phone (IndexedDB). Nothing here is ever sent to a server.

interface NivelDB extends DBSchema {
  calibrations: { key: number; value: Calibration; indexes: { createdAt: number } };
}

let dbPromise: Promise<IDBPDatabase<NivelDB>> | null = null;

function db() {
  dbPromise ??= openDB<NivelDB>("nivel", 1, {
    upgrade(d) {
      const cal = d.createObjectStore("calibrations", { keyPath: "id", autoIncrement: true });
      cal.createIndex("createdAt", "createdAt");
    },
  });
  return dbPromise;
}

/** Ask the browser not to evict our data. Best effort; ignored where unsupported. */
async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not fatal: data still lives in IndexedDB.
  }
}

export async function addCalibration(input: CalibrationInput): Promise<Calibration> {
  const value = { ...input, createdAt: Date.now() } as Calibration;
  const id = await (await db()).add("calibrations", value);
  void requestPersistence();
  return { ...value, id };
}

/** Newest first. */
export async function listCalibrations(): Promise<Calibration[]> {
  const all = await (await db()).getAllFromIndex("calibrations", "createdAt");
  return all.reverse();
}

export async function getLatestCalibration(): Promise<Calibration | null> {
  return (await listCalibrations())[0] ?? null;
}
