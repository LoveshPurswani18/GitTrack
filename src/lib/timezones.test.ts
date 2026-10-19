import { describe, expect, it } from "vitest";
import { filterZones, utcOffsetLabel, zoneOptions } from "./timezones";

describe("utcOffsetLabel", () => {
  const winter = new Date("2026-01-15T12:00:00Z");
  const summer = new Date("2026-07-15T12:00:00Z");

  it("formats a half-hour offset", () => {
    expect(utcOffsetLabel("Asia/Kolkata", winter)).toBe("UTC+5:30");
  });

  it("shows UTC+0 for UTC", () => {
    expect(utcOffsetLabel("UTC", winter)).toBe("UTC+0");
  });

  it("follows daylight saving", () => {
    expect(utcOffsetLabel("America/New_York", winter)).toBe("UTC-5");
    expect(utcOffsetLabel("America/New_York", summer)).toBe("UTC-4");
  });
});

describe("zoneOptions", () => {
  it("pins the browser zone, Asia/Kolkata and UTC first", () => {
    const { pinned, rest } = zoneOptions("Europe/Paris");
    expect(pinned).toEqual(["Europe/Paris", "Asia/Kolkata", "UTC"]);
    expect(rest).not.toContain("Europe/Paris");
    expect(rest).toContain("America/New_York");
  });

  it("does not repeat a pinned zone when the browser zone is one of them", () => {
    expect(zoneOptions("Asia/Kolkata").pinned).toEqual(["Asia/Kolkata", "UTC"]);
    expect(zoneOptions("UTC").pinned).toEqual(["UTC", "Asia/Kolkata"]);
  });

  it("lists the remaining zones alphabetically", () => {
    const { rest } = zoneOptions("UTC");
    expect(rest).toEqual([...rest].sort());
  });
});

describe("filterZones", () => {
  const zones = ["America/New_York", "Asia/Kolkata", "Europe/Paris"];

  it("matches case-insensitively", () => {
    expect(filterZones(zones, "KOLK")).toEqual(["Asia/Kolkata"]);
  });

  it("treats spaces and underscores the same", () => {
    expect(filterZones(zones, "new york")).toEqual(["America/New_York"]);
  });

  it("returns everything for an empty query", () => {
    expect(filterZones(zones, "  ")).toEqual(zones);
  });
});
