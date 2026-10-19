import { describe, expect, it } from "vitest";
import activityRaw from "./fixtures/raw/graphql-activity.json";
import prPage2Raw from "./fixtures/raw/graphql-pr-page-2.json";
import workCommitsRaw from "./fixtures/raw/rest-commits-work-repo-a.json";
import userRaw from "./fixtures/raw/rest-user.json";
import {
  buildCrossCheck,
  canFetchCommits,
  isWorkOwner,
  normalizeCommits,
  normalizeProfile,
  normalizePullRequest,
  normalizeRepo,
  type RawContributionsCollection,
  type RawPullRequest,
  type RawRestCommit,
  type RawUser,
} from "./normalize";

const collection = activityRaw.data.user.contributionsCollection as unknown as RawContributionsCollection;
const [gittrack, workA, , forked, , noBranch] = collection.commitContributionsByRepository.map((e) => e.repository);
const WINDOW = { from: "2025-10-15T12:00:00.000Z", to: "2026-10-14T12:00:00.000Z" };

describe("normalizeRepo", () => {
  it("flags work repos by owner, ignoring case", () => {
    expect(isWorkOwner("Work-Org", "work-org")).toBe(true);
    expect(normalizeRepo(workA, "work-org").isWork).toBe(true);
    expect(normalizeRepo(gittrack, "work-org").isWork).toBe(false);
  });

  it("maps the other fields and uses an empty branch when there is none", () => {
    expect(normalizeRepo(gittrack, "work-org")).toEqual({
      nameWithOwner: "demo-user/gittrack",
      url: "https://github.com/demo-user/gittrack",
      isPrivate: false,
      isWork: false,
      defaultBranch: "main",
    });
    expect(normalizeRepo(noBranch, "work-org").defaultBranch).toBe("");
  });

  it("skips commit fetches for forks and repos without a default branch", () => {
    expect(canFetchCommits(gittrack)).toBe(true);
    expect(canFetchCommits(forked)).toBe(false);
    expect(canFetchCommits(noBranch)).toBe(false);
  });
});

describe("normalizePullRequest", () => {
  const [open] = collection.pullRequestContributions.nodes.map((n) => n.pullRequest);
  const [merged, closed] = (prPage2Raw.data.user.contributionsCollection.pullRequestContributions.nodes as unknown as {
    pullRequest: RawPullRequest;
  }[]).map((n) => n.pullRequest);

  it("maps open, merged and closed-unmerged states", () => {
    expect(normalizePullRequest(open).state).toBe("open");
    expect(normalizePullRequest(merged).state).toBe("merged");
    const closedPr = normalizePullRequest(closed);
    expect(closedPr.state).toBe("closed");
    expect(closedPr.mergedAt).toBeNull();
    expect(closedPr.closedAt).toBe("2026-09-22T10:00:00Z");
  });

  it("uses the repo's nameWithOwner and keeps the timestamps as given", () => {
    expect(normalizePullRequest(merged)).toMatchObject({
      repo: "Work-Org/work-repo-a",
      number: 41,
      createdAt: "2026-10-02T08:00:00Z",
      mergedAt: "2026-10-03T09:00:00Z",
    });
  });
});

describe("normalizeCommits", () => {
  const raw = workCommitsRaw as unknown as RawRestCommit[];

  it("filters by author date, not committer date", () => {
    const shas = normalizeCommits(raw, "Work-Org/work-repo-a", WINDOW).map((c) => c.sha);
    // b2 was committed inside the window but authored before it; b3 has no author date.
    expect(shas).toEqual(["b100000000000000000000000000000000000001"]);
  });

  it("de-duplicates by sha", () => {
    expect(normalizeCommits(raw, "Work-Org/work-repo-a", WINDOW)).toHaveLength(1);
  });

  it("keeps only sha, repo and authoredAt (no message)", () => {
    const [commit] = normalizeCommits(raw, "Work-Org/work-repo-a", WINDOW);
    expect(Object.keys(commit).sort()).toEqual(["authoredAt", "repo", "sha"]);
  });

  it("keeps the instant of a 01:00 IST commit as UTC", () => {
    const late: RawRestCommit[] = [{ sha: "x", commit: { author: { date: "2026-10-10T19:30:00Z" } } }];
    expect(normalizeCommits(late, "r", WINDOW)[0].authoredAt).toBe("2026-10-10T19:30:00.000Z");
  });

  it("includes both window edges and excludes outside them", () => {
    const edges: RawRestCommit[] = [
      { sha: "start", commit: { author: { date: WINDOW.from } } },
      { sha: "end", commit: { author: { date: WINDOW.to } } },
      { sha: "before", commit: { author: { date: "2025-10-15T11:59:59Z" } } },
      { sha: "after", commit: { author: { date: "2026-10-14T12:00:01Z" } } },
    ];
    expect(normalizeCommits(edges, "r", WINDOW).map((c) => c.sha)).toEqual(["start", "end"]);
  });

  it("returns nothing for an empty list", () => {
    expect(normalizeCommits([], "r", WINDOW)).toEqual([]);
  });
});

describe("buildCrossCheck", () => {
  it("sums counts per reported day, sorted by date", () => {
    const crossCheck = buildCrossCheck(collection.commitContributionsByRepository);
    expect(crossCheck.find((d) => d.date === "2026-10-13")?.count).toBe(2);
    expect(crossCheck.find((d) => d.date === "2026-10-09")?.count).toBe(4);
    expect(crossCheck.map((d) => d.date)).toEqual([...crossCheck.map((d) => d.date)].sort());
  });

  it("is empty with no repos", () => {
    expect(buildCrossCheck([])).toEqual([]);
  });
});

describe("normalizeProfile", () => {
  it("maps the REST user fields", () => {
    expect(normalizeProfile(userRaw as RawUser)).toEqual({
      avatarUrl: "https://avatars.githubusercontent.com/u/0",
      name: "Demo User",
      login: "demo-user",
      bio: "Bio from GitHub",
      location: "Bengaluru, India",
      company: "work-org",
      followers: 48,
      following: 31,
      publicRepos: 27,
      createdAt: "2022-09-01T10:00:00Z",
      url: "https://github.com/demo-user",
    });
  });
});
