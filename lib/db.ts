import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Calibration, CalibrationInput } from "./calibration";
import type { WaterInSource } from "./analysis";
import type { Reading, ReadingPoint, ReadingSource } from "./readings";

export type EventTag = { startTs: number; source: WaterInSource };

// Everything in this file stays on the phone (IndexedDB). Nothing here is ever sent to a server.

interface NivelDB extends DBSchema {
  calibrations: { key: number; value: Calibration; indexes: { createdAt: number } };
  readings: { key: number; value: Reading; indexes: { ts: number; source: ReadingSource } };
  eventTags: { key: number; value: EventTag };
}

let dbPromise: Promise<IDBPDatabase<NivelDB>> | null = null;

function db() {
  dbPromise ??= openDB<NivelDB>("nivel", 3, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        const cal = d.createObjectStore("calibrations", { keyPath: "id", autoIncrement: true });
        cal.createIndex("createdAt", "createdAt");
      }
      if (oldVersion < 2) {
        const readings = d.createObjectStore("readings", { keyPath: "id", autoIncrement: true });
        readings.createIndex("ts", "ts");
        readings.createIndex("source", "source");
      }
      if (oldVersion < 3) {
        d.createObjectStore("eventTags", { keyPath: "startTs" });
      }
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

/**
 * Stores readings tagged with their source and the calibration they were taken under.
 * Skips timestamps already stored for that source, so re-importing a CSV doesn't duplicate.
 * Returns how many were added.
 */
export async function addReadings(
  points: ReadingPoint[],
  source: ReadingSource,
  calibrationId: number,
): Promise<number> {
  const tx = (await db()).transaction("readings", "readwrite");
  const existing = new Set((await tx.store.index("source").getAll(source)).map((r) => r.ts));
  let added = 0;
  for (const p of points) {
    if (existing.has(p.ts)) continue;
    existing.add(p.ts);
    void tx.store.add({ ...p, source, calibrationId } as Reading);
    added++;
  }
  await tx.done;
  void requestPersistence();
  return added;
}

/** Oldest first. */
export async function getAllReadings(): Promise<Reading[]> {
  return (await db()).getAllFromIndex("readings", "ts");
}

/** Swaps the simulated feed for a new one in a single transaction; real readings are untouched. */
export async function replaceSimulatedReadings(
  points: ReadingPoint[],
  calibrationId: number,
): Promise<number> {
  const tx = (await db()).transaction("readings", "readwrite");
  for await (const cursor of tx.store.index("source").iterate("simulated")) {
    await cursor.delete();
  }
  for (const p of points) {
    void tx.store.add({ ...p, source: "simulated", calibrationId } as Reading);
  }
  await tx.done;
  void requestPersistence();
  return points.length;
}

export async function deleteReadingsBySource(source: ReadingSource): Promise<void> {
  const tx = (await db()).transaction("readings", "readwrite");
  for await (const cursor of tx.store.index("source").iterate(source)) {
    await cursor.delete();
  }
  await tx.done;
}

/** The user's own label for a water-in event: red (tandeo), pipa or bomba. */
export async function setEventTag(tag: EventTag): Promise<void> {
  await (await db()).put("eventTags", tag);
}

export async function getEventTags(): Promise<EventTag[]> {
  return (await db()).getAll("eventTags");
}

/** "Borrar mis datos": wipes calibrations, readings and tags from this phone. */
export async function clearAllData(): Promise<void> {
  const tx = (await db()).transaction(["calibrations", "readings", "eventTags"], "readwrite");
  await Promise.all([
    tx.objectStore("calibrations").clear(),
    tx.objectStore("readings").clear(),
    tx.objectStore("eventTags").clear(),
    tx.done,
  ]);
}
