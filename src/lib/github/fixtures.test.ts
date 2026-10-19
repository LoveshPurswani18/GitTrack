import { describe, expect, it } from "vitest";
import { GitHubError } from "./errors";
import { loadFixtureActivity, loadFixtureProfile, resolveRelativeDate } from "./fixtures";

const NOW = new Date("2026-10-14T12:00:00Z");

// Builds YYYY-MM-DD from parts so the result does not depend on the locale's date pattern.
function dayIn(timeZone: string, iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const istDay = (iso: string) => dayIn("Asia/Kolkata", iso);
const utcDay = (iso: string) => dayIn("UTC", iso);

describe("resolveRelativeDate", () => {
  it("resolves relative to now", () => {
    expect(resolveRelativeDate({ daysAgo: 2, time: "10:00+05:30" }, NOW)).toBe(
      "2026-10-12T04:30:00.000Z",
    );
  });

  it("moves when now moves", () => {
    const later = new Date("2026-10-20T12:00:00Z");
    expect(resolveRelativeDate({ daysAgo: 2, time: "10:00+05:30" }, later)).toBe(
      "2026-10-18T04:30:00.000Z",
    );
  });

  it("puts 01:00 IST on the previous UTC day", () => {
    const iso = resolveRelativeDate({ daysAgo: 3, time: "01:00+05:30" }, NOW);
    expect(iso).toBe("2026-10-10T19:30:00.000Z");
    expect(istDay(iso)).toBe("2026-10-11");
    expect(utcDay(iso)).toBe("2026-10-10");
  });

  it("never returns a time after now", () => {
    expect(resolveRelativeDate({ daysAgo: 0, time: "23:00+05:30" }, NOW)).toBe(NOW.toISOString());
  });

  it("rejects a malformed time", () => {
    expect(() => resolveRelativeDate({ daysAgo: 0, time: "noon" }, NOW)).toThrow();
  });
});

describe("loadFixtureActivity", () => {
  const activity = loadFixtureActivity(null, NOW);

  it("stamps the fetch window from now", () => {
    expect(activity.fetchedAt).toBe(NOW.toISOString());
    expect(activity.windowEnd).toBe(NOW.toISOString());
    expect(activity.windowStart).toBe("2025-10-14T12:00:00.000Z");
  });

  it("keeps every commit inside the window, sorted by time", () => {
    const times = activity.commits.map((c) => c.authoredAt);
    expect(times).toEqual([...times].sort());
    expect(times.every((t) => t >= activity.windowStart && t <= activity.windowEnd)).toBe(true);
  });

  it("includes a 01:00 IST commit that falls on different UTC and IST days", () => {
    const lateNight = activity.commits.filter((c) => c.authoredAt.endsWith("T19:30:00.000Z"));
    expect(lateNight.length).toBeGreaterThan(0);
    expect(istDay(lateNight[0].authoredAt)).not.toBe(utcDay(lateNight[0].authoredAt));
  });

  it("includes both work repos with commits", () => {
    const work = activity.repos.filter((r) => r.isWork).map((r) => r.nameWithOwner);
    expect(work).toEqual(expect.arrayContaining(["work-org/work-repo-a", "work-org/work-repo-b"]));
    for (const name of work) {
      expect(activity.commits.some((c) => c.repo === name)).toBe(true);
    }
  });

  it("includes open, merged and closed pull requests", () => {
    const states = new Set(activity.pullRequests.map((pr) => pr.state));
    expect(states).toEqual(new Set(["open", "merged", "closed"]));
    const closed = activity.pullRequests.find((pr) => pr.state === "closed");
    expect(closed?.mergedAt).toBeNull();
    expect(closed?.closedAt).not.toBeNull();
  });

  it("only refers to repos that exist", () => {
    const names = new Set(activity.repos.map((r) => r.nameWithOwner));
    expect(activity.commits.every((c) => names.has(c.repo))).toBe(true);
    expect(activity.pullRequests.every((pr) => names.has(pr.repo))).toBe(true);
  });

  it("expands counts into commits with unique SHAs", () => {
    const shas = new Set(activity.commits.map((c) => c.sha));
    expect(shas.size).toBe(activity.commits.length);
  });

  it("has a default-branch streak ending yesterday, with today's commits only on feature branches", () => {
    const defaultDays = new Set(activity.commits.filter((c) => c.onDefault).map((c) => istDay(c.authoredAt)));
    expect(defaultDays.has("2026-10-14")).toBe(false);
    expect(defaultDays.has("2026-10-13")).toBe(true);
    expect(defaultDays.has("2026-10-12")).toBe(true);

    const today = activity.commits.filter((c) => istDay(c.authoredAt) === "2026-10-14");
    expect(today.length).toBeGreaterThan(0);
    expect(today.every((c) => !c.onDefault)).toBe(true);
  });

  it("includes feature-branch commits in personal and work repos", () => {
    const branchOnly = activity.commits.filter((c) => !c.onDefault);
    const isWork = new Map(activity.repos.map((r) => [r.nameWithOwner, r.isWork]));
    expect(branchOnly.some((c) => isWork.get(c.repo) === false)).toBe(true);
    expect(branchOnly.some((c) => isWork.get(c.repo) === true)).toBe(true);
    expect(activity.commits.some((c) => c.onDefault)).toBe(true);
  });

  it("has no superseded commits", () => {
    expect(activity.supersededCommits).toEqual([]);
  });

  it("has enough history for the 1Y heatmap", () => {
    expect(activity.commits[0].authoredAt < "2026-03-01").toBe(true);
  });

  it("only uses the made-up owners", () => {
    const owners = new Set(activity.repos.map((r) => r.nameWithOwner.split("/")[0]));
    expect(owners).toEqual(new Set(["demo-user", "work-org"]));
  });
});

describe("fixture states", () => {
  it("returns no commits or pull requests for empty", () => {
    const empty = loadFixtureActivity("empty", NOW);
    expect(empty.commits).toEqual([]);
    expect(empty.pullRequests).toEqual([]);
    expect(empty.repos.length).toBeGreaterThan(0);
  });

  it("throws a rate_limit error with a reset time", () => {
    try {
      loadFixtureActivity("rate_limit", NOW);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubError);
      expect((error as GitHubError).kind).toBe("rate_limit");
      expect((error as GitHubError).resetAt).toBe("2026-10-14T12:30:00.000Z");
    }
  });

  it("throws a token error", () => {
    expect(() => loadFixtureActivity("token_error", NOW)).toThrow(GitHubError);
    expect(() => loadFixtureProfile("token_error", NOW)).toThrow(GitHubError);
  });
});

describe("loadFixtureProfile", () => {
  it("resolves the join date to ISO UTC", () => {
    const profile = loadFixtureProfile(null, NOW);
    expect(profile.login).toBe("demo-user");
    expect(profile.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("does not depend on the empty state", () => {
    expect(loadFixtureProfile("empty", NOW).login).toBe("demo-user");
  });
});
