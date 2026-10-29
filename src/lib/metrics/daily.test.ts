import { describe, expect, it } from "vitest";
import { commit, PERSONAL_REPO } from "@/test/factories";
import { activeDays, dailyCounts } from "./daily";

const IST_LATE_NIGHT = commit(PERSONAL_REPO, "2026-10-10T19:30:00Z"); // 01:00 IST on 11 Oct

describe("dailyCounts", () => {
  const bounds = { start: "2026-10-09", end: "2026-10-12" };

  it("groups the 01:00 IST commit by the selected timezone", () => {
    expect(dailyCounts([IST_LATE_NIGHT], "Asia/Kolkata", bounds).get("2026-10-11")).toBe(1);
    expect(dailyCounts([IST_LATE_NIGHT], "UTC", bounds).get("2026-10-10")).toBe(1);
    expect(dailyCounts([IST_LATE_NIGHT], "UTC", bounds).get("2026-10-11")).toBe(0);
  });

  it("zero-fills every day in order", () => {
    const counts = dailyCounts([], "UTC", bounds);
    expect([...counts]).toEqual([
      ["2026-10-09", 0],
      ["2026-10-10", 0],
      ["2026-10-11", 0],
      ["2026-10-12", 0],
    ]);
  });

  it("ignores commits outside the bounds", () => {
    const counts = dailyCounts([commit(PERSONAL_REPO, "2026-09-01T10:00:00Z")], "UTC", bounds);
    expect([...counts.values()].every((n) => n === 0)).toBe(true);
    expect(counts.size).toBe(4);
  });

  it("counts several commits on one day", () => {
    const commits = [
      commit(PERSONAL_REPO, "2026-10-10T05:00:00Z"),
      commit(PERSONAL_REPO, "2026-10-10T06:00:00Z"),
    ];
    expect(dailyCounts(commits, "UTC", bounds).get("2026-10-10")).toBe(2);
  });
});

describe("activeDays", () => {
  it("returns the distinct local days", () => {
    const commits = [IST_LATE_NIGHT, commit(PERSONAL_REPO, "2026-10-11T05:00:00Z")];
    expect([...activeDays(commits, "Asia/Kolkata")]).toEqual(["2026-10-11"]);
    expect([...activeDays(commits, "UTC")].sort()).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("is empty with no commits", () => {
    expect(activeDays([], "UTC").size).toBe(0);
  });
});
