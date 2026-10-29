import { describe, expect, it } from "vitest";
import {
  activity,
  commit,
  PERSONAL_REPO,
  pr,
  WORK_REPO_A,
  WORK_REPO_B,
} from "@/test/factories";
import { dailyCounts } from "./daily";
import { filterByScope, type Scope } from "./filter";
import { heatmapGrid } from "./heatmap";
import { commitsByRepo } from "./projects";
import { prStats } from "./prs";
import { type Range, rangeBounds } from "./range";
import { totalInRange } from "./summary";

// 20:00Z is already the 15th in Asia/Kolkata and still the 14th in UTC and New York.
const NOW = new Date("2026-10-14T20:00:00Z");
const RANGES: Range[] = ["today", "1w", "1m", "6m", "1y"];
const SCOPES: Scope[] = ["all", "personal", "work"];
const ZONES = ["UTC", "Asia/Kolkata", "America/New_York"];

// Spread over a year, including late-night IST commits, day edges and a repo that is not listed.
const COMMITS = [
  ...["2025-10-20T10:00:00Z", "2026-04-15T23:59:00Z", "2026-04-16T00:00:00Z", "2026-09-30T18:29:59Z", "2026-09-30T18:30:00Z"].map(
    (at) => commit(PERSONAL_REPO, at),
  ),
  ...["2026-10-07T19:30:00Z", "2026-10-08T20:00:00Z", "2026-10-13T20:00:00Z", "2026-10-14T19:00:00Z", "2026-10-14T19:59:00Z"].map(
    (at) => commit(WORK_REPO_A, at),
  ),
  ...["2026-10-14T01:00:00Z", "2026-10-14T18:30:00Z", "2026-10-12T05:00:00Z"].map((at) => commit(WORK_REPO_B, at)),
  commit("someone/unlisted", "2026-10-14T10:00:00Z"),
];

const gridTotal = (weeks: ReturnType<typeof heatmapGrid>["weeks"]) =>
  weeks.flat().reduce((sum, cell) => sum + (cell?.count ?? 0), 0);

describe("every surface agrees on the same number", () => {
  for (const range of RANGES) {
    for (const scope of SCOPES) {
      for (const tz of ZONES) {
        it(`${range} / ${scope} / ${tz}`, () => {
          const filtered = filterByScope(activity({ commits: COMMITS }), scope);
          const bounds = rangeBounds(range, NOW, tz);
          const total = totalInRange(filtered.commits, tz, bounds);
          const daily = dailyCounts(filtered.commits, tz, bounds);

          expect([...daily.values()].reduce((a, b) => a + b, 0)).toBe(total);
          expect(gridTotal(heatmapGrid(daily, bounds).weeks)).toBe(total);
          expect(commitsByRepo(filtered, tz, bounds).reduce((a, p) => a + p.count, 0)).toBe(total);
        });
      }
    }
  }

  it("personal + work equals all, per range and timezone", () => {
    for (const range of RANGES) {
      for (const tz of ZONES) {
        const bounds = rangeBounds(range, NOW, tz);
        const count = (scope: Scope) =>
          totalInRange(filterByScope(activity({ commits: COMMITS }), scope).commits, tz, bounds);
        expect(count("personal") + count("work")).toBe(count("all"));
      }
    }
  });
});

describe("rangeBounds", () => {
  it("covers 182 local days for 6m, ending today in the selected zone", () => {
    expect(rangeBounds("6m", NOW, "UTC")).toEqual({ start: "2026-04-16", end: "2026-10-14" });
    expect(rangeBounds("6m", NOW, "Asia/Kolkata")).toEqual({ start: "2026-04-17", end: "2026-10-15" });
  });
});

describe("filterByScope across all record types", () => {
  const data = activity({
    commits: COMMITS,
    pullRequests: [
      pr({ number: 1, repo: PERSONAL_REPO }),
      pr({ number: 2, repo: WORK_REPO_A }),
      pr({ number: 3, repo: "someone/unlisted" }),
    ],
  });

  it("splits repos and pull requests cleanly, with orphans in no scope", () => {
    const personal = filterByScope(data, "personal");
    const work = filterByScope(data, "work");
    const all = filterByScope(data, "all");
    expect(personal.repos.length + work.repos.length).toBe(all.repos.length);
    expect(personal.pullRequests.length + work.pullRequests.length).toBe(all.pullRequests.length);
    expect(all.pullRequests.map((p) => p.number)).toEqual([1, 2]);
  });

  it("drops everything in every scope when no repo is listed", () => {
    for (const scope of SCOPES) {
      const result = filterByScope({ ...data, repos: [] }, scope);
      expect(result.commits).toEqual([]);
      expect(result.pullRequests).toEqual([]);
    }
  });

  it("keeps the pull request counts consistent with the scope split", () => {
    const bounds = rangeBounds("1y", NOW, "UTC");
    const opened = (scope: Scope) => prStats(filterByScope(data, scope).pullRequests, "UTC", bounds).opened;
    expect(opened("personal") + opened("work")).toBe(opened("all"));
  });
});
