import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isActive } from "./nav";

describe("bottom nav", () => {
  it("has the four tabs in order", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Tinaco",
      "Historial",
      "Pipa",
      "Ajustes",
    ]);
  });

  it("marks the active tab", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/pipa")).toBe(false);
    expect(isActive("/pipa", "/pipa")).toBe(true);
    expect(isActive("/pipa", "/pipa/orden/1")).toBe(true);
    expect(isActive("/pipa", "/pipas")).toBe(false);
  });
});
