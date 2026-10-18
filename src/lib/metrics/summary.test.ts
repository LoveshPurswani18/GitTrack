import { describe, expect, it } from "vitest";
import { commit, PERSONAL_REPO } from "@/test/factories";
import { commitsToday, thisWeekVsLast, totalInRange } from "./summary";

const at = (iso: string) => commit(PERSONAL_REPO, iso);

describe("commitsToday", () => {
  it("follows the selected timezone", () => {
    const now = new Date("2026-10-14T20:00:00Z"); // 15 Oct in IST, 14 Oct in UTC
    const commits = [at("2026-10-14T19:00:00Z"), at("2026-10-14T10:00:00Z")]; // 15 Oct IST, 14 Oct IST
    expect(commitsToday(commits, "Asia/Kolkata", now)).toBe(1);
    expect(commitsToday(commits, "UTC", now)).toBe(2);
  });

  it("is 0 with no commits", () => {
    expect(commitsToday([], "UTC", new Date("2026-10-14T12:00:00Z"))).toBe(0);
  });
});

describe("totalInRange", () => {
  it("counts only commits inside the bounds", () => {
    const commits = [at("2026-10-07T10:00:00Z"), at("2026-10-08T10:00:00Z"), at("2026-10-14T10:00:00Z")];
    expect(totalInRange(commits, "UTC", { start: "2026-10-08", end: "2026-10-14" })).toBe(2);
  });

  it("is 0 for an empty range", () => {
    expect(totalInRange([], "UTC", { start: "2026-10-08", end: "2026-10-14" })).toBe(0);
  });
});

describe("thisWeekVsLast", () => {
  it("compares Monday to today with the same span last week (midweek)", () => {
    const now = new Date("2026-10-14T12:00:00Z"); // Wed
    const commits = [
      at("2026-10-12T05:00:00Z"), // this Mon
      at("2026-10-14T05:00:00Z"), // this Wed
      at("2026-10-05T05:00:00Z"), // last Mon
      at("2026-10-07T05:00:00Z"), // last Wed: counted
      at("2026-10-08T05:00:00Z"), // last Thu: not counted
    ];
    expect(thisWeekVsLast(commits, "UTC", now)).toEqual({ thisWeek: 2, lastWeek: 2, delta: 0 });
  });

  it("compares 1 day with 1 day on a Monday, with the week boundary tz-dependent", () => {
    const now = new Date("2026-10-12T12:00:00Z"); // Mon 17:30 IST, Mon in UTC
    const commits = [
      at("2026-10-11T19:00:00Z"), // Mon 00:30 IST: this week in IST, last week (Sun) in UTC
      at("2026-10-11T18:00:00Z"), // Sun 23:30 IST: last week in both
      at("2026-10-05T04:30:00Z"), // last Mon 10:00 IST
    ];
    expect(thisWeekVsLast(commits, "Asia/Kolkata", now)).toEqual({ thisWeek: 1, lastWeek: 1, delta: 0 });
    expect(thisWeekVsLast(commits, "UTC", now)).toEqual({ thisWeek: 0, lastWeek: 1, delta: -1 });
  });

  it("is all zeros with no commits", () => {
    expect(thisWeekVsLast([], "UTC", new Date("2026-10-14T12:00:00Z"))).toEqual({
      thisWeek: 0,
      lastWeek: 0,
      delta: 0,
    });
  });
});
