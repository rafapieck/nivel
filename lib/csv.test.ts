import { describe, expect, it } from "vitest";
import { parseReadingsCsv, parseTimestamp } from "./csv";

// Packet test 10 (logic half): malformed rows get a message, valid rows are kept.
describe("parseReadingsCsv", () => {
  it("accepts valid rows with and without header", () => {
    const text = "timestamp,distance_cm\n2026-10-20T10:00:00Z,45.2\n1792490400,46\n";
    const { rows, errors } = parseReadingsCsv(text);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { ts: Date.parse("2026-10-20T10:00:00Z"), distanceCm: 45.2 },
      { ts: 1792490400000, distanceCm: 46 },
    ]);
  });

  it("reports malformed rows by line and keeps the good ones", () => {
    const text = [
      "timestamp,distance_cm",
      "2026-10-20T10:00:00Z,45",
      "ayer,45",
      "2026-10-20T10:10:00Z,500",
      "2026-10-20T10:20:00Z",
      "2026-10-20T10:30:00Z,abc",
      "2026-10-20T10:40:00Z,44",
    ].join("\n");
    const { rows, errors } = parseReadingsCsv(text);
    expect(rows).toHaveLength(2);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
    expect(errors[1].message).toMatch(/0 y 400 cm/);
  });

  it("parses seconds and milliseconds", () => {
    expect(parseTimestamp("1792490400")).toBe(1792490400000);
    expect(parseTimestamp("1792490400000")).toBe(1792490400000);
  });
});
