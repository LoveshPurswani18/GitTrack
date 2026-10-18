import { describe, expect, it } from "vitest";
import { addDays, dayRange, startOfWeek, toLocalDay, weekday } from "./days";

describe("toLocalDay", () => {
  it("puts a 01:00 IST commit on different days in IST and UTC", () => {
    const iso = "2026-10-10T19:30:00Z";
    expect(toLocalDay(iso, "Asia/Kolkata")).toBe("2026-10-11");
    expect(toLocalDay(iso, "UTC")).toBe("2026-10-10");
  });

  it("accepts a Date", () => {
    expect(toLocalDay(new Date("2026-10-10T19:30:00Z"), "Asia/Kolkata")).toBe("2026-10-11");
  });

  it("throws RangeError for an unknown timezone", () => {
    expect(() => toLocalDay("2026-10-10T19:30:00Z", "Not/AZone")).toThrow(RangeError);
  });
});

describe("day arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-10-14", 0)).toBe("2026-10-14");
  });

  it("builds an inclusive day range", () => {
    expect(dayRange("2026-10-09", "2026-10-11")).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(dayRange("2026-10-09", "2026-10-09")).toEqual(["2026-10-09"]);
    expect(dayRange("2026-10-10", "2026-10-09")).toEqual([]);
  });

  it("numbers weekdays from Monday", () => {
    expect(weekday("2026-10-12")).toBe(0); // Monday
    expect(weekday("2026-10-11")).toBe(6); // Sunday
  });

  it("finds the Monday of a week", () => {
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-14")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
  });
});
