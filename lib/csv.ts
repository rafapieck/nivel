import { readingPoint, type ReadingPoint } from "./readings";

export const CSV_MAX_ROWS = 20000;

export type CsvRowError = { line: number; message: string };
export type CsvParseResult = { rows: ReadingPoint[]; errors: CsvRowError[] };

/** Accepts ISO 8601 dates or Unix time in seconds or milliseconds. */
export function parseTimestamp(raw: string): number {
  const s = raw.trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Math.round(n >= 1e12 ? n : n * 1000);
  }
  return Date.parse(s);
}

/**
 * Parses the sensor format `timestamp,distance_cm`. The header row is optional.
 * Every bad row gets a line-numbered message in Spanish; good rows are kept.
 */
export function parseReadingsCsv(text: string): CsvParseResult {
  const rows: ReadingPoint[] = [];
  const errors: CsvRowError[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    const line = i + 1;
    const content = rawLine.trim();
    if (content === "") return;
    if (i === 0 && /timestamp/i.test(content)) return;

    if (rows.length >= CSV_MAX_ROWS) {
      if (rows.length === CSV_MAX_ROWS && errors.at(-1)?.message.startsWith("Máximo") !== true) {
        errors.push({ line, message: `Máximo ${CSV_MAX_ROWS} filas por archivo; el resto no se importó` });
      }
      return;
    }

    const cells = content.split(",");
    if (cells.length !== 2) {
      errors.push({ line, message: "Se esperaban 2 columnas: timestamp,distance_cm" });
      return;
    }
    const ts = parseTimestamp(cells[0]);
    if (Number.isNaN(ts)) {
      errors.push({ line, message: `Fecha no reconocida: "${cells[0].trim().slice(0, 30)}"` });
      return;
    }
    const distance = cells[1].trim() === "" ? NaN : Number(cells[1]);
    const parsed = readingPoint.safeParse({ ts, distanceCm: distance });
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues[0].message });
      return;
    }
    rows.push(parsed.data);
  });

  return { rows, errors };
}

/** CSV backup of the owner's own readings, in the same format the importer reads. */
export function readingsToCsv(
  readings: { ts: number; distanceCm: number; source: string }[],
): string {
  const lines = ["timestamp,distance_cm,source"];
  for (const r of readings) {
    lines.push(`${new Date(r.ts).toISOString()},${r.distanceCm},${r.source}`);
  }
  return lines.join("\n") + "\n";
}
