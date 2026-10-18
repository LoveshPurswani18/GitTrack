import { describe, expect, it } from "vitest";
import { pr } from "@/test/factories";
import { prStats, recentPrs } from "./prs";

const bounds = { start: "2026-10-08", end: "2026-10-14" };
const open = pr({ number: 1, state: "open", createdAt: "2026-10-13T10:00:00Z" });
const merged = pr({
  number: 2,
  state: "merged",
  createdAt: "2026-10-09T10:00:00Z",
  mergedAt: "2026-10-10T10:00:00Z",
  closedAt: "2026-10-10T10:00:00Z",
});
const closedUnmerged = pr({
  number: 3,
  state: "closed",
  createdAt: "2026-10-11T10:00:00Z",
  closedAt: "2026-10-12T10:00:00Z",
});
const old = pr({ number: 4, state: "open", createdAt: "2026-08-01T10:00:00Z" });

describe("prStats", () => {
  it("counts opened and merged in range, and open now regardless of range", () => {
    expect(prStats([open, merged, closedUnmerged, old], "UTC", bounds)).toEqual({
      opened: 3,
      openNow: 2,
      merged: 1,
    });
  });

  it("counts a closed-unmerged PR as opened only", () => {
    expect(prStats([closedUnmerged], "UTC", bounds)).toEqual({ opened: 1, openNow: 0, merged: 0 });
  });

  it("counts a merge in range even if the PR was opened earlier", () => {
    const longRunning = pr({ state: "merged", createdAt: "2026-08-01T10:00:00Z", mergedAt: "2026-10-09T10:00:00Z" });
    expect(prStats([longRunning], "UTC", bounds)).toEqual({ opened: 0, openNow: 0, merged: 1 });
  });

  it("is all zeros for no PRs", () => {
    expect(prStats([], "UTC", bounds)).toEqual({ opened: 0, openNow: 0, merged: 0 });
  });
});

describe("recentPrs", () => {
  it("returns PRs opened in range, newest first, keeping the closed state", () => {
    const result = recentPrs([merged, open, closedUnmerged, old], "UTC", bounds);
    expect(result.map((p) => p.number)).toEqual([1, 3, 2]);
    expect(result.find((p) => p.number === 3)?.state).toBe("closed");
  });

  it("excludes a PR created before the range", () => {
    expect(recentPrs([old], "UTC", bounds)).toEqual([]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 8 }, (_, i) => pr({ number: i, createdAt: `2026-10-1${i % 5}T10:00:00Z` }));
    expect(recentPrs(many, "UTC", bounds)).toHaveLength(5);
    expect(recentPrs(many, "UTC", bounds, 2)).toHaveLength(2);
  });
});

describe("timezone", () => {
  it("puts a 01:00 IST PR on the IST day", () => {
    const late = pr({
      state: "merged",
      createdAt: "2026-10-07T19:30:00Z", // 01:00 IST on 8 Oct, 7 Oct in UTC
      mergedAt: "2026-10-07T19:30:00Z",
    });
    expect(prStats([late], "Asia/Kolkata", bounds)).toEqual({ opened: 1, openNow: 0, merged: 1 });
    expect(prStats([late], "UTC", bounds)).toEqual({ opened: 0, openNow: 0, merged: 0 });
    expect(recentPrs([late], "Asia/Kolkata", bounds)).toHaveLength(1);
    expect(recentPrs([late], "UTC", bounds)).toEqual([]);
  });
});
