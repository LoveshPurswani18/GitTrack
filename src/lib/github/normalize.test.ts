import { describe, expect, it } from "vitest";
import type { Commit } from "@/types/activity";
import activityRaw from "./fixtures/raw/graphql-activity.json";
import branchesRaw from "./fixtures/raw/graphql-branches.json";
import prPage2Raw from "./fixtures/raw/graphql-pr-page-2.json";
import prCommitsRestRaw from "./fixtures/raw/rest-pr-commits-work-repo-c-60.json";
import workCommitsRaw from "./fixtures/raw/rest-commits-work-repo-a.json";
import userRaw from "./fixtures/raw/rest-user.json";
import {
  buildCrossCheck,
  canFetchCommits,
  isWorkOwner,
  mergeCommitSets,
  normalizeBranchHistories,
  normalizeCommits,
  normalizeProfile,
  normalizePullRequest,
  normalizePullRequestCommits,
  normalizePullRequestRestCommits,
  normalizeRepo,
  type PullRequestCommits,
  type RawBranchHistory,
  type RawContributionsCollection,
  type RawPullRequest,
  type RawPullRequestRestCommit,
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
    const shas = normalizeCommits(raw, "Work-Org/work-repo-a", WINDOW, false).map((c) => c.sha);
    // b2 was committed inside the window but authored before it; b3 has no author date.
    expect(shas).toEqual(["b100000000000000000000000000000000000001"]);
  });

  it("de-duplicates by sha", () => {
    expect(normalizeCommits(raw, "Work-Org/work-repo-a", WINDOW, false)).toHaveLength(1);
  });

  it("keeps only sha, repo, authoredAt and onDefault (no message)", () => {
    const [commit] = normalizeCommits(raw, "Work-Org/work-repo-a", WINDOW, false);
    expect(Object.keys(commit).sort()).toEqual(["authoredAt", "onDefault", "repo", "sha"]);
  });

  it("keeps the instant of a 01:00 IST commit as UTC", () => {
    const late: RawRestCommit[] = [{ sha: "x", commit: { author: { date: "2026-10-10T19:30:00Z" } } }];
    expect(normalizeCommits(late, "r", WINDOW, false)[0].authoredAt).toBe("2026-10-10T19:30:00.000Z");
  });

  it("includes both window edges and excludes outside them", () => {
    const edges: RawRestCommit[] = [
      { sha: "start", commit: { author: { date: WINDOW.from } } },
      { sha: "end", commit: { author: { date: WINDOW.to } } },
      { sha: "before", commit: { author: { date: "2025-10-15T11:59:59Z" } } },
      { sha: "after", commit: { author: { date: "2026-10-14T12:00:01Z" } } },
    ];
    expect(normalizeCommits(edges, "r", WINDOW, false).map((c) => c.sha)).toEqual(["start", "end"]);
  });

  it("returns nothing for an empty list", () => {
    expect(normalizeCommits([], "r", WINDOW, false)).toEqual([]);
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

describe("normalizeCommits onDefault", () => {
  it("stamps every commit with the given onDefault", () => {
    const raw: RawRestCommit[] = [{ sha: "x", commit: { author: { date: "2026-10-10T10:00:00Z" } } }];
    expect(normalizeCommits(raw, "r", WINDOW, true)[0].onDefault).toBe(true);
    expect(normalizeCommits(raw, "r", WINDOW, false)[0].onDefault).toBe(false);
  });
});

describe("normalizeBranchHistories", () => {
  const branches = branchesRaw["demo-user/gittrack"].refs.nodes as unknown as RawBranchHistory[];
  const result = normalizeBranchHistories(branches, "demo-user/gittrack", "main", WINDOW);
  const flags = Object.fromEntries(result.commits.map((c) => [c.sha.slice(0, 2), c.onDefault]));

  it("collects my commits from every branch, once per sha", () => {
    expect(result.commits.map((c) => c.sha.slice(0, 2)).sort()).toEqual(["a1", "a2", "d1", "f1", "f2"]);
  });

  it("flags only commits that are on the default branch", () => {
    // a1 is on main and on feat/metrics: it counts as a default-branch commit.
    expect(flags).toEqual({ a1: true, a2: true, d1: false, f1: false, f2: false });
  });

  it("lists branches whose history was cut at 100 commits", () => {
    expect(result.overflow).toEqual(["main"]);
  });

  it("skips refs that are not commits", () => {
    const odd: RawBranchHistory[] = [
      { name: "odd", target: {} },
      { name: "null", target: null },
    ];
    expect(normalizeBranchHistories(odd, "r", "main", WINDOW)).toEqual({ commits: [], overflow: [] });
  });

  it("keeps only commits authored inside the window, by author date", () => {
    const outside: RawBranchHistory[] = [
      {
        name: "main",
        target: {
          history: {
            pageInfo: { hasNextPage: false },
            nodes: [
              { oid: "in", authoredDate: "2026-10-10T10:00:00Z" },
              { oid: "before", authoredDate: "2025-10-15T11:59:59Z" },
              { oid: "after", authoredDate: "2026-10-14T12:00:01Z" },
            ],
          },
        },
      },
    ];
    expect(normalizeBranchHistories(outside, "r", "main", WINDOW).commits.map((c) => c.sha)).toEqual(["in"]);
  });
});

describe("pull request commits", () => {
  const nodes = prPage2Raw.data.user.contributionsCollection.pullRequestContributions
    .nodes as unknown as { pullRequest: RawPullRequest }[];
  const byNumber = (n: number) => nodes.find((x) => x.pullRequest.number === n)!.pullRequest;

  it("keeps only my commits, dropping other people's and unlinked authors", () => {
    const squash = normalizePullRequestCommits(byNumber(41), "demo-user", WINDOW);
    expect(squash.commits.map((c) => c.sha.slice(0, 2))).toEqual(["p1", "p2"]);
    expect(squash.commits.every((c) => !c.onDefault && c.repo === "Work-Org/work-repo-a")).toBe(true);
  });

  it("matches the author login ignoring case", () => {
    expect(normalizePullRequestCommits(byNumber(41), "DEMO-User", WINDOW).commits).toHaveLength(2);
  });

  it("tells squash and rebase merges (one parent) from a true merge (two parents)", () => {
    expect(normalizePullRequestCommits(byNumber(41), "demo-user", WINDOW)).toMatchObject({
      rewritten: true,
      mergeCommitSha: expect.stringMatching(/^m4/),
    });
    expect(normalizePullRequestCommits(byNumber(13), "demo-user", WINDOW).rewritten).toBe(true);
    expect(normalizePullRequestCommits(byNumber(5), "demo-user", WINDOW).rewritten).toBe(false);
  });

  it("has no merge commit for a PR that was not merged", () => {
    expect(normalizePullRequestCommits(byNumber(12), "demo-user", WINDOW)).toMatchObject({
      mergeCommitSha: null,
      rewritten: false,
    });
  });

  it("is incomplete when GraphQL returned fewer commits than the PR has", () => {
    expect(normalizePullRequestCommits(byNumber(60), "demo-user", WINDOW).complete).toBe(false);
    expect(normalizePullRequestCommits(byNumber(41), "demo-user", WINDOW).complete).toBe(true);
  });

  it("reads my commits from the REST list by author login", () => {
    const commits = normalizePullRequestRestCommits(
      prCommitsRestRaw as unknown as RawPullRequestRestCommit[],
      "Work-Org/work-repo-c",
      "demo-user",
      WINDOW,
    );
    expect(commits.map((c) => c.sha.slice(0, 2))).toEqual(["l1", "l2"]);
    expect(commits.every((c) => !c.onDefault)).toBe(true);
  });
});

describe("mergeCommitSets", () => {
  const REPO = "demo-user/app";
  const make = (sha: string, authoredAt: string, onDefault = false, repo = REPO): Commit => ({
    sha,
    repo,
    authoredAt,
    onDefault,
  });
  const pr = (overrides: Partial<PullRequestCommits>): PullRequestCommits => ({
    repo: REPO,
    commits: [],
    mergeCommitSha: null,
    rewritten: false,
    complete: true,
    ...overrides,
  });
  const shas = (commits: Commit[]) => commits.map((c) => c.sha);

  it("keeps one commit per sha and ORs onDefault", () => {
    const { commits } = mergeCommitSets({
      commits: [make("a", "2026-10-10T10:00:00Z", false), make("a", "2026-10-10T10:00:00Z", true)],
      pullRequests: [pr({ commits: [make("a", "2026-10-10T10:00:00Z", false), make("b", "2026-10-11T10:00:00Z")] })],
    });
    expect(commits.map((c) => [c.sha, c.onDefault])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("keeps squash-merged work on its real days and drops the squash commit", () => {
    const p1 = make("p1", "2026-10-01T10:00:00Z");
    const p2 = make("p2", "2026-10-02T06:00:00Z");
    const squash = make("m", "2026-10-03T09:00:00Z", true);
    const { commits, superseded } = mergeCommitSets({
      commits: [squash],
      pullRequests: [pr({ commits: [p1, p2], mergeCommitSha: "m", rewritten: true })],
    });
    expect(shas(commits)).toEqual(["p1", "p2"]);
    expect(shas(superseded)).toEqual(["m"]);
  });

  it("drops the rebased copies on the default branch, matching by repo and author time", () => {
    const original = [make("r1", "2026-10-05T04:00:00Z"), make("r2", "2026-10-06T04:00:00Z")];
    const copies = [make("c1", "2026-10-05T04:00:00Z", true), make("c2", "2026-10-06T04:00:00Z", true)];
    const { commits, superseded } = mergeCommitSets({
      commits: copies,
      pullRequests: [pr({ commits: original, mergeCommitSha: "c2", rewritten: true })],
    });
    expect(shas(commits)).toEqual(["r1", "r2"]);
    expect(shas(superseded)).toEqual(["c1", "c2"]);
  });

  it("drops nothing for a true merge, because the shas are the same", () => {
    const t1 = make("t1", "2026-10-08T05:00:00Z", true);
    const merge = make("mt", "2026-10-08T07:00:00Z", true);
    const { commits, superseded } = mergeCommitSets({
      commits: [t1, merge],
      pullRequests: [pr({ commits: [make("t1", "2026-10-08T05:00:00Z")], mergeCommitSha: "mt", rewritten: false })],
    });
    expect(commits.map((c) => [c.sha, c.onDefault])).toEqual([
      ["t1", true],
      ["mt", true],
    ]);
    expect(superseded).toEqual([]);
  });

  it("keeps the merge commit when none of the PR's own commits are mine", () => {
    const merge = make("m", "2026-10-03T09:00:00Z", true);
    const { commits, superseded } = mergeCommitSets({
      commits: [merge],
      pullRequests: [pr({ commits: [], mergeCommitSha: "m", rewritten: true })],
    });
    expect(shas(commits)).toEqual(["m"]);
    expect(superseded).toEqual([]);
  });

  it("never drops a commit that is one of the PR's own", () => {
    const same = make("x", "2026-10-03T09:00:00Z", true);
    const { commits, superseded } = mergeCommitSets({
      commits: [same],
      pullRequests: [pr({ commits: [make("x", "2026-10-03T09:00:00Z")], mergeCommitSha: "x", rewritten: true })],
    });
    expect(shas(commits)).toEqual(["x"]);
    expect(superseded).toEqual([]);
  });

  it("only matches rebase copies inside the same repo", () => {
    const other = make("o", "2026-10-05T04:00:00Z", true, "demo-user/other");
    const { commits } = mergeCommitSets({
      commits: [other],
      pullRequests: [
        pr({ commits: [make("r1", "2026-10-05T04:00:00Z")], mergeCommitSha: "zz", rewritten: true }),
      ],
    });
    expect(shas(commits)).toEqual(["o", "r1"]);
  });

  it("sorts by author time then sha and leaves its input alone", () => {
    const input = [make("b", "2026-10-10T10:00:00Z"), make("a", "2026-10-10T10:00:00Z"), make("c", "2026-10-09T10:00:00Z")];
    const copy = structuredClone(input);
    expect(shas(mergeCommitSets({ commits: input, pullRequests: [] }).commits)).toEqual(["c", "a", "b"]);
    expect(input).toEqual(copy);
  });
});
