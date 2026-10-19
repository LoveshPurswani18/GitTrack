import { describe, expect, it } from "vitest";
import { controlsToSearch, isValidTimeZone, parseControls, rangeLabel } from "./controls";

describe("parseControls", () => {
  it("uses the defaults (6m, all, browser zone) for an empty query", () => {
    expect(parseControls("", "Asia/Kolkata")).toEqual({
      range: "6m",
      scope: "all",
      tz: "Asia/Kolkata",
    });
  });

  it("reads every control from the query", () => {
    expect(parseControls("?range=1w&repos=work&tz=UTC", "Asia/Kolkata")).toEqual({
      range: "1w",
      scope: "work",
      tz: "UTC",
    });
  });

  it("falls back to the default for an invalid range or repos value", () => {
    const parsed = parseControls("?range=5y&repos=everything", "UTC");
    expect(parsed.range).toBe("6m");
    expect(parsed.scope).toBe("all");
  });

  it("falls back to the browser zone for an unknown timezone", () => {
    expect(parseControls("?tz=Mars/Olympus", "Asia/Kolkata").tz).toBe("Asia/Kolkata");
    expect(parseControls("?tz=", "Asia/Kolkata").tz).toBe("Asia/Kolkata");
  });

  it("falls back to UTC when the browser zone is not valid either", () => {
    expect(parseControls("", "Not/AZone").tz).toBe("UTC");
  });

  it("ignores the old scope parameter and unknown parameters", () => {
    expect(parseControls("?scope=work&foo=bar", "UTC").scope).toBe("all");
  });

  it("accepts a timezone whose slash is percent-encoded", () => {
    expect(parseControls("?tz=America%2FNew_York", "UTC").tz).toBe("America/New_York");
  });
});

describe("controlsToSearch", () => {
  it("writes range, repos and tz with the slash encoded", () => {
    expect(controlsToSearch({ range: "1m", scope: "personal", tz: "Asia/Kolkata" })).toBe(
      "?range=1m&repos=personal&tz=Asia%2FKolkata",
    );
  });

  it("round-trips through parseControls", () => {
    const controls = { range: "1y", scope: "work", tz: "America/New_York" } as const;
    expect(parseControls(controlsToSearch(controls), "UTC")).toEqual(controls);
  });
});

describe("rangeLabel", () => {
  it("reads as DESIGN.md §2 words", () => {
    expect([rangeLabel("today"), rangeLabel("1w"), rangeLabel("1m")]).toEqual([
      "today",
      "last 7 days",
      "last month",
    ]);
    expect([rangeLabel("6m"), rangeLabel("1y")]).toEqual(["last 6 months", "last 12 months"]);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects the rest", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
