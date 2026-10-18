import { describe, expect, it } from "vitest";
import { inBounds, RANGE_DAYS, rangeBounds } from "./range";

const NOW = new Date("2026-10-14T12:00:00Z");

describe("rangeBounds", () => {
  it("ends today and spans the rolling number of days", () => {
    expect(rangeBounds("today", NOW, "Asia/Kolkata")).toEqual({ start: "2026-10-14", end: "2026-10-14" });
    expect(rangeBounds("1w", NOW, "Asia/Kolkata")).toEqual({ start: "2026-10-08", end: "2026-10-14" });
    expect(rangeBounds("1m", NOW, "UTC")).toEqual({ start: "2026-09-15", end: "2026-10-14" });
    expect(RANGE_DAYS["6m"]).toBe(182);
    expect(rangeBounds("1y", NOW, "UTC")).toEqual({ start: "2025-10-15", end: "2026-10-14" });
  });

  it("follows the timezone for today", () => {
    const lateUtc = new Date("2026-10-14T20:00:00Z"); // already 15 Oct in IST
    expect(rangeBounds("today", lateUtc, "UTC").end).toBe("2026-10-14");
    expect(rangeBounds("today", lateUtc, "Asia/Kolkata").end).toBe("2026-10-15");
  });

  it("counts local days across a DST change", () => {
    // US clocks went back on 2026-11-01; the 1w window is still 7 local days.
    const now = new Date("2026-11-03T15:00:00Z");
    expect(rangeBounds("1w", now, "America/New_York")).toEqual({ start: "2026-10-28", end: "2026-11-03" });
  });
});

describe("inBounds", () => {
  const bounds = { start: "2026-10-08", end: "2026-10-14" };
  it("is inclusive at both ends", () => {
    expect(inBounds("2026-10-08", bounds)).toBe(true);
    expect(inBounds("2026-10-14", bounds)).toBe(true);
    expect(inBounds("2026-10-07", bounds)).toBe(false);
    expect(inBounds("2026-10-15", bounds)).toBe(false);
  });
});
