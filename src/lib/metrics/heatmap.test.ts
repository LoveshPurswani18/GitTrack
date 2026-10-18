import { describe, expect, it } from "vitest";
import { dailyCounts } from "./daily";
import { commit, PERSONAL_REPO } from "@/test/factories";
import { type Level, heatmapGrid, level, levelThresholds } from "./heatmap";
import { rangeBounds } from "./range";

const levelsFor = (counts: number[]) => {
  const th = levelThresholds(counts);
  return { th, of: (n: number) => level(n, th) };
};

describe("levelThresholds / level", () => {
  it("handles no active days", () => {
    expect(levelThresholds([])).toEqual({ t1: 0, t2: 0, t3: 0, max: 0 });
    expect(levelThresholds([0, 0])).toEqual({ t1: 0, t2: 0, t3: 0, max: 0 });
    expect(level(0, levelThresholds([]))).toBe(0);
  });

  it("handles one active day", () => {
    const { th, of } = levelsFor([5]);
    expect(th).toEqual({ t1: 5, t2: 5, t3: 5, max: 5 });
    expect(of(5)).toBe(4);
  });

  it("handles two active days", () => {
    const { th, of } = levelsFor([1, 5]);
    expect(th).toEqual({ t1: 1, t2: 1, t3: 5, max: 5 });
    expect([of(1), of(5)]).toEqual([1, 4]);
  });

  it("handles three active days", () => {
    const { th, of } = levelsFor([1, 2, 3]);
    expect(th).toEqual({ t1: 1, t2: 2, t3: 3, max: 3 });
    expect([of(1), of(2), of(3)]).toEqual([1, 2, 4]);
  });

  it("gives equal counts the top level", () => {
    const { th, of } = levelsFor([3, 3, 3]);
    expect(th).toEqual({ t1: 3, t2: 3, t3: 3, max: 3 });
    expect(of(3)).toBe(4);
  });

  it("handles an uneven distribution", () => {
    const { th, of } = levelsFor([1, 1, 1, 1, 1, 1, 10]);
    expect(th).toEqual({ t1: 1, t2: 1, t3: 1, max: 10 });
    expect([of(1), of(10)]).toEqual([1, 4]);
  });

  it("splits 1..8 into pairs", () => {
    const { th, of } = levelsFor([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(th).toEqual({ t1: 2, t2: 4, t3: 6, max: 8 });
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(of)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("copes with duplicate thresholds", () => {
    const { th, of } = levelsFor([1, 1, 1, 5, 9]);
    expect(th).toEqual({ t1: 1, t2: 1, t3: 5, max: 9 });
    expect([of(1), of(5), of(9)]).toEqual([1, 3, 4]);
  });

  it("always gives 1–4 for non-zero counts, never decreasing", () => {
    const samples = [[5], [1, 5], [1, 2, 3], [3, 3, 3], [1, 1, 1, 1, 1, 1, 10], [1, 1, 1, 5, 9], [2, 4, 6, 8, 10, 12]];
    for (const counts of samples) {
      const th = levelThresholds(counts);
      let previous: Level = 1;
      for (let n = 1; n <= Math.max(...counts) + 2; n++) {
        const l = level(n, th);
        expect(l).toBeGreaterThanOrEqual(1);
        expect(l).toBeLessThanOrEqual(4);
        expect(l).toBeGreaterThanOrEqual(previous);
        previous = l;
      }
    }
  });
});

describe("heatmapGrid", () => {
  it("lays out Monday-first week columns with null padding outside the bounds", () => {
    // Wed 14 Oct, 1w = Thu 8 Oct .. Wed 14 Oct → weeks starting Mon 5 Oct and Mon 12 Oct
    const bounds = rangeBounds("1w", new Date("2026-10-14T12:00:00Z"), "UTC");
    const { weeks } = heatmapGrid(dailyCounts([], "UTC", bounds), bounds);
    expect(weeks).toHaveLength(2);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]); // Mon–Wed before the range
    expect(weeks[0][3]?.day).toBe("2026-10-08");
    expect(weeks[1][2]?.day).toBe("2026-10-14");
    expect(weeks[1].slice(3)).toEqual([null, null, null, null]); // after today
  });

  it("is all level 0 for an empty range", () => {
    const bounds = rangeBounds("1m", new Date("2026-10-14T12:00:00Z"), "UTC");
    const { weeks } = heatmapGrid(dailyCounts([], "UTC", bounds), bounds);
    const cells = weeks.flat().filter((c) => c !== null);
    expect(cells).toHaveLength(30);
    expect(cells.every((c) => c.level === 0 && c.count === 0)).toBe(true);
  });

  it("moves the 01:00 IST commit between days with the timezone", () => {
    const commits = [commit(PERSONAL_REPO, "2026-10-10T19:30:00Z")];
    const now = new Date("2026-10-14T12:00:00Z");
    const cellFor = (tz: string, day: string) => {
      const bounds = rangeBounds("1w", now, tz);
      return heatmapGrid(dailyCounts(commits, tz, bounds), bounds).weeks.flat().find((c) => c?.day === day);
    };
    expect(cellFor("Asia/Kolkata", "2026-10-11")?.count).toBe(1);
    expect(cellFor("UTC", "2026-10-10")?.count).toBe(1);
    expect(cellFor("UTC", "2026-10-11")?.count).toBe(0);
  });

  it("spans 53 or 54 week columns for 1y", () => {
    const bounds = rangeBounds("1y", new Date("2026-10-14T12:00:00Z"), "UTC");
    const { weeks } = heatmapGrid(dailyCounts([], "UTC", bounds), bounds);
    expect([53, 54]).toContain(weeks.length);
  });

  it("gives the busiest day level 4", () => {
    const commits = [
      commit(PERSONAL_REPO, "2026-10-13T10:00:00Z"),
      commit(PERSONAL_REPO, "2026-10-13T11:00:00Z"),
      commit(PERSONAL_REPO, "2026-10-12T10:00:00Z"),
    ];
    const bounds = rangeBounds("1w", new Date("2026-10-14T12:00:00Z"), "UTC");
    const cells = heatmapGrid(dailyCounts(commits, "UTC", bounds), bounds).weeks.flat();
    expect(cells.find((c) => c?.day === "2026-10-13")?.level).toBe(4);
    expect(cells.find((c) => c?.day === "2026-10-12")?.level).toBe(1);
  });
});
