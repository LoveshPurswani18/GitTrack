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

describe("day and week edges in the selected timezone", () => {
  it("splits the day at local midnight, not at UTC midnight", () => {
    const now = new Date("2026-10-14T20:00:00Z"); // 15 Oct in IST
    const commits = [at("2026-10-14T18:29:59Z"), at("2026-10-14T18:30:00Z")]; // 14 Oct and 15 Oct IST
    expect(commitsToday(commits, "Asia/Kolkata", now)).toBe(1);
    expect(totalInRange(commits, "Asia/Kolkata", { start: "2026-10-14", end: "2026-10-14" })).toBe(1);
  });

  it("a Monday after midnight in IST is still Sunday in UTC, so the week differs", () => {
    const now = new Date("2026-10-11T19:00:00Z"); // Mon 12 Oct 00:30 IST, Sun 11 Oct UTC
    const commits = [at("2026-10-06T10:00:00Z"), at("2026-10-11T18:45:00Z")]; // Tue, and Mon 00:15 IST
    expect(thisWeekVsLast(commits, "Asia/Kolkata", now).thisWeek).toBe(1);
    expect(thisWeekVsLast(commits, "UTC", now).thisWeek).toBe(2);
  });

  it("on a Sunday, this week spans the whole Monday to Sunday", () => {
    const now = new Date("2026-10-18T12:00:00Z"); // Sunday
    const commits = [at("2026-10-12T10:00:00Z"), at("2026-10-18T10:00:00Z"), at("2026-10-05T10:00:00Z")];
    const week = thisWeekVsLast(commits, "UTC", now);
    expect(week.thisWeek).toBe(2);
    expect(week.lastWeek).toBe(1);
  });
});
