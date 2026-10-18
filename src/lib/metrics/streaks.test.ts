import { describe, expect, it } from "vitest";
import { commit, PERSONAL_REPO } from "@/test/factories";
import { currentStreak, longestStreak } from "./streaks";

const NOW = new Date("2026-10-14T12:00:00Z"); // Wed 17:30 IST
const onDay = (day: string) => commit(PERSONAL_REPO, `${day}T06:00:00Z`);

describe("currentStreak", () => {
  it("is 0 with no commits", () => {
    expect(currentStreak([], "UTC", NOW)).toBe(0);
    expect(longestStreak([], "UTC")).toBe(0);
  });

  it("counts a streak that includes today", () => {
    const commits = ["2026-10-12", "2026-10-13", "2026-10-14"].map(onDay);
    expect(currentStreak(commits, "UTC", NOW)).toBe(3);
  });

  it("still counts a streak that ended yesterday", () => {
    const commits = ["2026-10-11", "2026-10-12", "2026-10-13"].map(onDay);
    expect(currentStreak(commits, "UTC", NOW)).toBe(3);
  });

  it("is 0 once the streak is broken (last commit two days ago), longest unchanged", () => {
    const commits = ["2026-10-10", "2026-10-11", "2026-10-12"].map(onDay);
    expect(currentStreak(commits, "UTC", NOW)).toBe(0);
    expect(longestStreak(commits, "UTC")).toBe(3);
  });

  it("uses the 01:00 IST commit's IST day to bridge a gap", () => {
    // 10 Oct 19:30Z is 11 Oct in IST: 11, 12, 13 are consecutive in IST, 10, 12, 13 are not in UTC.
    const commits = [
      commit(PERSONAL_REPO, "2026-10-10T19:30:00Z"),
      onDay("2026-10-12"),
      onDay("2026-10-13"),
    ];
    expect(currentStreak(commits, "Asia/Kolkata", NOW)).toBe(3);
    expect(currentStreak(commits, "UTC", NOW)).toBe(2);
  });
});

describe("longestStreak", () => {
  it("finds the longest of several runs", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-10", "2026-09-11", "2026-09-12", "2026-10-01"];
    expect(longestStreak(days.map(onDay), "UTC")).toBe(3);
  });

  it("counts several commits on one day once", () => {
    const commits = [onDay("2026-10-10"), onDay("2026-10-10")];
    expect(longestStreak(commits, "UTC")).toBe(1);
  });
});
