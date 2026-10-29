import { describe, expect, it } from "vitest";
import { createFakeFetch, jsonResponse, type FakeRequest } from "@/test/fakeFetch";
import { dailyCounts, filterByScope, rangeBounds } from "@/lib/metrics";
import { createGitHubClient } from "./client";
import { fetchLiveActivity, fetchLiveProfile } from "./live";
import activityRaw from "./fixtures/raw/graphql-activity.json";
import branchesRaw from "./fixtures/raw/graphql-branches.json";
import branchesWorkAPage2 from "./fixtures/raw/graphql-branches-work-repo-a-page-2.json";
import prPage2Raw from "./fixtures/raw/graphql-pr-page-2.json";
import reposPage1 from "./fixtures/raw/graphql-repositories-page-1.json";
import reposPage2 from "./fixtures/raw/graphql-repositories-page-2.json";
import gittrackPage1 from "./fixtures/raw/rest-commits-gittrack-page-1.json";
import gittrackPage2 from "./fixtures/raw/rest-commits-gittrack-page-2.json";
import prCommitsWorkC from "./fixtures/raw/rest-pr-commits-work-repo-c-60.json";
import userRaw from "./fixtures/raw/rest-user.json";

const NOW = new Date("2026-10-14T12:00:00Z");
const WORK_ORG = "work-org";

type GraphQLCall = { query: string; variables: Record<string, unknown> };

type FixtureBranch = { name: string; target: { committedDate?: string; history?: unknown } | null };
type FixtureRefs = { refs: { nodes: FixtureBranch[] } };

/** Step A: each aliased repo (r0, r1, ...) lists its branches with names and tip dates only. */
function branchListData(variables: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (let i = 0; `o${i}` in variables; i++) {
    const repo = `${variables[`o${i}`]}/${variables[`n${i}`]}`;
    const secondPage = repo === "Work-Org/work-repo-a" && variables.after === "refs-cursor-1";
    const page = (secondPage ? branchesWorkAPage2 : (branchesRaw as Record<string, unknown>)[repo]) as
      | (FixtureRefs & { refs: { pageInfo: unknown } })
      | null
      | undefined;
    data[`r${i}`] = page
      ? {
          refs: {
            pageInfo: page.refs.pageInfo,
            nodes: page.refs.nodes.map(({ name, target }) => ({
              name,
              target: target && "committedDate" in target ? { committedDate: target.committedDate } : target,
            })),
          },
        }
      : null;
  }
  return data;
}

/** Step B: the named branches (b0, b1, ...) of one repo, with the commit history from the fixtures. */
function historyData(variables: Record<string, unknown>) {
  const repo = `${variables.o}/${variables.n}`;
  const known = (branchesRaw as Record<string, FixtureRefs | null>)[repo];
  if (!known) return { repository: null };
  const branches = [...known.refs.nodes, ...(repo === "Work-Org/work-repo-a" ? branchesWorkAPage2.refs.nodes : [])];
  const aliases: Record<string, unknown> = {};
  for (let i = 0; `q${i}` in variables; i++) {
    const name = String(variables[`q${i}`]).replace("refs/heads/", "");
    const branch = branches.find((b) => b.name === name);
    aliases[`b${i}`] = branch ? { target: branch.target && { history: branch.target.history } } : null;
  }
  return { repository: aliases };
}

function route(request: FakeRequest): Response {
  const { url } = request;
  if (url.endsWith("/graphql")) {
    const { query, variables } = JSON.parse(request.body!) as GraphQLCall;
    if (query.includes("query BranchList")) return jsonResponse({ data: branchListData(variables) });
    if (query.includes("query BranchHistories")) return jsonResponse({ data: historyData(variables) });
    if (query.includes("repositories(")) {
      return jsonResponse(variables.after === "repo-cursor-1" ? reposPage2 : reposPage1);
    }
    return jsonResponse(variables.after === "cursor-1" ? prPage2Raw : activityRaw);
  }
  // Only the default branch of gittrack is cut at 100 commits, so REST reads it in full.
  if (url.includes("/repos/demo-user/gittrack/commits")) {
    if (url.includes("page=2")) return jsonResponse(gittrackPage2);
    return jsonResponse(gittrackPage1, {
      headers: { link: '<https://api.github.com/repos/demo-user/gittrack/commits?page=2>; rel="next"' },
    });
  }
  if (url.includes("/repos/Work-Org/work-repo-c/pulls/60/commits")) return jsonResponse(prCommitsWorkC);
  if (url.endsWith("/users/demo-user")) return jsonResponse(userRaw);
  return jsonResponse({ message: `unexpected request: ${url}` }, { status: 404 });
}

function setup(handler: (request: FakeRequest) => Response = route) {
  const fake = createFakeFetch(handler);
  const lines: string[] = [];
  const client = createGitHubClient({
    token: "ghp_testtoken",
    fetchImpl: fake.fetch,
    now: () => NOW,
    log: (line) => lines.push(line),
  });
  return { fake, client, lines };
}

async function load(handler?: (request: FakeRequest) => Response) {
  const { fake, client, lines } = setup(handler);
  const activity = await fetchLiveActivity({ username: "demo-user", workOrg: WORK_ORG, client, now: NOW });
  return { activity, fake, lines };
}

const graphqlCalls = (fake: { requests: FakeRequest[] }): GraphQLCall[] =>
  fake.requests.filter((r) => r.url.endsWith("/graphql")).map((r) => JSON.parse(r.body!) as GraphQLCall);
const branchCalls = (fake: { requests: FakeRequest[] }) =>
  graphqlCalls(fake).filter((c) => c.query.includes("query BranchList"));
const historyCalls = (fake: { requests: FakeRequest[] }) =>
  graphqlCalls(fake).filter((c) => c.query.includes("query BranchHistories"));
const restCalls = (fake: { requests: FakeRequest[] }) =>
  fake.requests.map((r) => r.url).filter((u) => !u.endsWith("/graphql"));
/** "a1:default" or "f1:branch": the sha tag and whether it is on the default branch. */
const tag = (c: { sha: string; onDefault: boolean }) => `${c.sha.slice(0, 2)}:${c.onDefault ? "default" : "branch"}`;

describe("fetchLiveActivity", () => {
  it("builds the fetch window from the injected now (364 days)", async () => {
    const { activity } = await load();
    expect(activity.username).toBe("demo-user");
    expect(activity.windowStart).toBe("2025-10-15T12:00:00.000Z");
    expect(activity.windowEnd).toBe("2026-10-14T12:00:00.000Z");
    expect(activity.fetchedAt).toBe("2026-10-14T12:00:00.000Z");
  });

  it("lists contribution repos, PR-only repos and discovered repos, flagging work repos", async () => {
    const { activity } = await load();
    expect(activity.repos.map((r) => [r.nameWithOwner, r.isWork])).toEqual([
      ["demo-user/gittrack", false],
      ["Work-Org/work-repo-a", true],
      ["Work-Org/work-repo-b", true],
      ["demo-user/forked-lib", false],
      ["demo-user/empty-repo", false],
      ["demo-user/no-branch", false],
      ["other-org/oss-project", false], // only from a pull request
      ["Work-Org/work-repo-c", true], // only from a pull request, then found by recent pushes too
      ["demo-user/branch-only", false], // only found by recent pushes: its work is all on branches
    ]);
  });

  it("finds repos by recent pushes and stops paging at the end of the window", async () => {
    const { fake } = await load();
    const discovery = graphqlCalls(fake).filter((c) => c.query.includes("repositories("));
    // The second page ends with a repo pushed before the window, so no third page is read
    // even though GitHub says there is more.
    expect(discovery.map((c) => c.variables.after)).toEqual([null, "repo-cursor-1"]);
  });

  it("scans only repos that can have my commits, five per request, with my user id", async () => {
    const { fake } = await load();
    const calls = branchCalls(fake);
    const scanned = calls
      .filter((c) => c.variables.after === null)
      .map((c) => {
        const repos: string[] = [];
        for (let i = 0; `o${i}` in c.variables; i++) repos.push(`${c.variables[`o${i}`]}/${c.variables[`n${i}`]}`);
        return repos;
      });
    expect(scanned).toEqual([
      [
        "demo-user/gittrack",
        "Work-Org/work-repo-a",
        "Work-Org/work-repo-b",
        "demo-user/empty-repo",
        "Work-Org/work-repo-c",
      ],
      ["demo-user/branch-only"],
    ]);
    // Not scanned: a fork, a repo without a default branch, and a repo that only has a PR.
    const names = scanned.flat().join(" ");
    expect(["forked-lib", "no-branch", "oss-project"].some((n) => names.includes(n))).toBe(false);
    expect(calls[0].query).toContain('refPrefix: "refs/heads/"');
    expect(calls[0].query).not.toContain("history("); // the listing is light: names and tip dates
    const histories = historyCalls(fake);
    expect(histories.every((c) => c.variables.userId === "U_demo")).toBe(true);
    expect(histories[0].variables.since).toBe("2025-10-12T12:00:00.000Z"); // window start − 3 days
    expect(histories[0].query).toContain("author: { id: $userId }");
  });

  it("keeps paging a repo that has more branches than one page", async () => {
    const { fake } = await load();
    const followUps = branchCalls(fake).filter((c) => c.variables.after === "refs-cursor-1");
    expect(followUps).toHaveLength(1);
    expect(followUps[0].variables).toMatchObject({ o0: "Work-Org", n0: "work-repo-a" });
  });

  it("reads a branch cut at 100 commits completely through REST, and only that branch", async () => {
    const { fake } = await load();
    // Branch commit lists only: /repos/{owner}/{repo}/commits, not a PR's /pulls/{n}/commits.
    const commitCalls = restCalls(fake).filter((u) => /\/repos\/[^/]+\/[^/]+\/commits\?/.test(u));
    const gittrack = commitCalls.filter((u) => u.includes("demo-user/gittrack/commits"));
    expect(gittrack).toHaveLength(2); // two pages
    const params = new URL(gittrack[0]).searchParams;
    expect(params.get("author")).toBe("demo-user");
    expect(params.get("sha")).toBe("main");
    expect(params.get("per_page")).toBe("100");
    expect(params.get("since")).toBe("2025-10-12T12:00:00.000Z"); // window start − 3 days
    expect(params.get("until")).toBe("2026-10-17T12:00:00.000Z"); // window end + 3 days
    expect(commitCalls.filter((u) => !u.includes("demo-user/gittrack/commits"))).toEqual([]);
  });

  it("reads a pull request with more commits than GraphQL returned through REST", async () => {
    const { fake } = await load();
    const prCalls = restCalls(fake).filter((u) => u.includes("/pulls/"));
    expect(prCalls).toEqual(["https://api.github.com/repos/Work-Org/work-repo-c/pulls/60/commits?per_page=100"]);
  });

  it("counts my commits from every branch, plus the commits inside my PRs", async () => {
    const { activity } = await load();
    expect(activity.commits.map(tag)).toEqual([
      "x1:branch", // closed PR, branch deleted
      "p1:branch", // squash-merged PR, branch deleted
      "p2:branch",
      "r1:branch", // rebase-merged PR
      "r2:branch",
      "t1:default", // true merge: same shas on the default branch
      "mt:default",
      "l1:branch", // large PR read through REST
      "l2:branch",
      "a3:default",
      "c1:default",
      "e1:branch", // a repo whose work is only on a branch
      "e2:branch",
      "a2:default",
      "b1:default",
      "f1:branch",
      "f2:branch",
      "a1:default",
      "b4:branch", // second page of branches
      "d1:branch", // today
    ]);
  });

  it("drops other people's commits, unlinked authors, PR-only repos and duplicates", async () => {
    const { activity } = await load();
    const tags = activity.commits.map((c) => c.sha.slice(0, 2));
    expect(tags).not.toContain("k1"); // a colleague's commit in a PR
    expect(tags).not.toContain("k2");
    expect(tags).not.toContain("u1"); // commit whose email is not linked to an account
    expect(tags).not.toContain("o1"); // commit in a PR to a repo I do not belong to
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("drops squash and rebase copies from the commits and keeps them as superseded", async () => {
    const { activity } = await load();
    expect(activity.supersededCommits.map(tag)).toEqual(["m4:default", "r3:default", "r4:default"]);
    const shown = new Set(activity.commits.map((c) => c.sha));
    expect(activity.supersededCommits.some((c) => shown.has(c.sha))).toBe(false);
    // The default-branch part of our commits plus the superseded ones is what GitHub counts.
    const defaultBranch = [...activity.commits.filter((c) => c.onDefault), ...activity.supersededCommits];
    expect(defaultBranch.map((c) => c.sha.slice(0, 2)).sort()).toEqual(
      ["a1", "a2", "a3", "b1", "c1", "m4", "mt", "r3", "r4", "t1"].sort(),
    );
  });

  it("reads pull requests across both pages, oldest first", async () => {
    const { activity, fake } = await load();
    expect(activity.pullRequests.map((p) => [p.number, p.state])).toEqual([
      [12, "closed"],
      [41, "merged"],
      [13, "merged"],
      [3, "open"],
      [5, "merged"],
      [60, "open"],
      [7, "open"],
    ]);
    const prPages = graphqlCalls(fake).filter((c) => c.variables.after === "cursor-1");
    expect(prPages).toHaveLength(1);
  });

  it("makes a small, bounded number of GraphQL calls", async () => {
    const { fake } = await load();
    // activity + PR page, 2 discovery pages, 2 branch-list batches + 1 list follow-up page,
    // then one history request for each of the 5 repos that have an active branch.
    expect(graphqlCalls(fake)).toHaveLength(12);
  });

  it("carries the restricted count and the debug cross-check", async () => {
    const { activity } = await load();
    expect(activity.restrictedCount).toBe(2);
    expect(activity.crossCheck.length).toBeGreaterThan(0);
  });

  it("never runs more than 6 requests at once", async () => {
    const { fake } = await load();
    expect(fake.maxInFlight()).toBeLessThanOrEqual(6);
  });

  it("surfaces a REST rate limit as a rate_limit error", async () => {
    const reset = String(Date.parse("2026-10-14T12:30:00Z") / 1000);
    const limited = (request: FakeRequest) =>
      request.url.includes("demo-user/gittrack/commits")
        ? jsonResponse(
            { message: "API rate limit exceeded" },
            { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset } },
          )
        : route(request);
    await expect(load(limited)).rejects.toMatchObject({
      kind: "rate_limit",
      resetAt: "2026-10-14T12:30:00.000Z",
    });
  });

  it("fails with a network error when the user is not found", async () => {
    const missing = (request: FakeRequest) =>
      request.url.endsWith("/graphql") ? jsonResponse({ data: { user: null } }) : route(request);
    await expect(load(missing)).rejects.toMatchObject({ kind: "network" });
  });

  it("fails rather than undercount when a repo cannot be read", async () => {
    const hidden = (request: FakeRequest) => {
      if (request.url.endsWith("/graphql")) {
        const { query } = JSON.parse(request.body!) as GraphQLCall;
        if (query.includes("query BranchList")) return jsonResponse({ data: { r0: null } });
      }
      return route(request);
    };
    await expect(load(hidden)).rejects.toMatchObject({ kind: "network" });
  });

  it("skips a never-pushed repo instead of ending discovery", async () => {
    // GitHub does not document where null push times sort. If they came first, stopping at one
    // would silently drop every repo after it, so discovery must carry on past it.
    const [work, , branchOnly] = reposPage1.data.user.repositories.nodes;
    const neverPushed = { ...work, nameWithOwner: "demo-user/never-pushed", pushedAt: null };
    const nullFirst = (request: FakeRequest) => {
      if (request.url.endsWith("/graphql")) {
        const { query } = JSON.parse(request.body!) as GraphQLCall;
        if (query.includes("repositories(")) {
          return jsonResponse({
            data: {
              user: {
                repositories: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [neverPushed, branchOnly],
                },
              },
            },
          });
        }
      }
      return route(request);
    };
    const { activity, fake } = await load(nullFirst);
    const names = activity.repos.map((r) => r.nameWithOwner);
    expect(names).toContain("demo-user/branch-only"); // found after the null entry
    expect(names).not.toContain("demo-user/never-pushed"); // no push means no commits, so it is not scanned
    expect(branchCalls(fake).flatMap((c) => Object.values(c.variables)).includes("never-pushed")).toBe(false);
  });

  it("fails rather than drop repos when there are too many repository pages", async () => {
    const endless = (request: FakeRequest) => {
      if (request.url.endsWith("/graphql")) {
        const { query } = JSON.parse(request.body!) as GraphQLCall;
        if (query.includes("repositories(")) {
          const [recent] = reposPage1.data.user.repositories.nodes;
          return jsonResponse({
            data: { user: { repositories: { pageInfo: { hasNextPage: true, endCursor: "more" }, nodes: [recent] } } },
          });
        }
      }
      return route(request);
    };
    await expect(load(endless)).rejects.toMatchObject({ kind: "network" });
  });

  it("fits the metrics library: scope filter and IST vs UTC days", async () => {
    const { activity } = await load();
    const bounds = rangeBounds("1w", NOW, "Asia/Kolkata");

    const work = filterByScope(activity, "work");
    expect(work.commits.map((c) => c.sha.slice(0, 2))).toEqual([
      "x1", "p1", "p2", "r1", "r2", "l1", "l2", "c1", "b1", "b4",
    ]);
    expect(work.pullRequests.map((p) => p.number)).toEqual([12, 41, 13, 60]);
    // The PR-only repo is in `repos`, so its PR is kept rather than dropped.
    expect(filterByScope(activity, "personal").pullRequests.map((p) => p.number)).toEqual([3, 5, 7]);

    // The 01:00 IST commit (10 Oct 19:30Z) is 11 Oct in IST, 10 Oct in UTC.
    const ist = dailyCounts(activity.commits, "Asia/Kolkata", bounds);
    expect(ist.get("2026-10-11")).toBe(2); // 01:00 IST commit + a 09:30 IST commit
    expect(ist.get("2026-10-14")).toBe(2); // today, both on feature branches
    const utc = dailyCounts(activity.commits, "UTC", rangeBounds("1w", NOW, "UTC"));
    expect(utc.get("2026-10-10")).toBe(3);
    expect(utc.get("2026-10-11")).toBe(1);
  });
});

describe("fetchLiveProfile", () => {
  it("loads and maps the user", async () => {
    const { client, fake } = setup();
    const profile = await fetchLiveProfile({ username: "demo-user", client, now: NOW });
    expect(profile.login).toBe("demo-user");
    expect(profile.fetchedAt).toBe(NOW.toISOString());
    expect(profile.publicRepos).toBe(27);
    expect(fake.requests).toHaveLength(1);
  });
});

describe("branch scan for repos with many branches", () => {
  const ACTIVE = "2026-10-10T00:00:00Z";
  const OLD = "2025-01-01T00:00:00Z"; // before the window (it starts 2025-10-12 with padding)

  const listed = (name: string, committedDate: string) => ({ name, target: { committedDate } });
  const historyOf = (oid: string) => ({
    history: { pageInfo: { hasNextPage: false }, nodes: [{ oid, authoredDate: ACTIVE }] },
  });

  /**
   * work-repo-a lists its branches from `listPage(after)`; every other repo and every history
   * request uses the fixtures, except where `history` answers a branch for work-repo-a.
   */
  function bigWorkRepo(
    listPage: (after: string | null) => { nodes: ReturnType<typeof listed>[]; next: string | null },
    history: (branch: string) => unknown = (branch) => historyOf(`c0${branch.length}`.padEnd(40, "0")),
  ) {
    return (request: FakeRequest) => {
      if (request.url.endsWith("/graphql")) {
        const { query, variables } = JSON.parse(request.body!) as GraphQLCall;
        if (query.includes("query BranchList")) {
          const data = branchListData(variables) as Record<string, unknown>;
          for (let i = 0; `o${i}` in variables; i++) {
            if (`${variables[`o${i}`]}/${variables[`n${i}`]}` !== "Work-Org/work-repo-a") continue;
            const { nodes, next } = listPage((variables.after as string | null) ?? null);
            data[`r${i}`] = { refs: { pageInfo: { hasNextPage: next !== null, endCursor: next }, nodes } };
          }
          return jsonResponse({ data });
        }
        if (query.includes("query BranchHistories") && variables.n === "work-repo-a") {
          const aliases: Record<string, unknown> = {};
          for (let i = 0; `q${i}` in variables; i++) {
            const branch = String(variables[`q${i}`]).replace("refs/heads/", "");
            const result = history(branch);
            aliases[`b${i}`] = result === null ? null : { target: result };
          }
          return jsonResponse({ data: { repository: aliases } });
        }
      }
      return route(request);
    };
  }
  const workAHistories = (fake: { requests: FakeRequest[] }) =>
    historyCalls(fake).filter((c) => c.variables.n === "work-repo-a");
  const askedFor = (call: GraphQLCall) =>
    Object.entries(call.variables)
      .filter(([key]) => /^q\d+$/.test(key))
      .map(([, value]) => String(value).replace("refs/heads/", ""));

  it("never asks for the history of a branch whose tip is before the window", async () => {
    const { fake } = await load();
    const asked = historyCalls(fake).flatMap(askedFor);
    expect(asked).not.toContain("feat/stale");
    expect(asked).toContain("feat/metrics");
  });

  it("lists all 14 pages of a 1,300-branch repo but reads history only for the active branches", async () => {
    const pages = Array.from({ length: 14 }, (_, p) => ({
      nodes: Array.from({ length: p === 13 ? 18 : 100 }, (_, i) =>
        listed(`old-${p}-${i}`, p === 3 && i === 7 ? ACTIVE : p === 9 && i === 1 ? ACTIVE : OLD),
      ),
      next: p === 13 ? null : `page-${p + 1}`,
    }));
    const { fake, lines } = await load(bigWorkRepo((after) => pages[after ? Number(after.slice(5)) : 0]));
    const cursors = branchCalls(fake)
      .filter((c) => c.variables.n0 === "work-repo-a" || c.variables.after !== null)
      .map((c) => c.variables.after);
    expect(cursors).toContain("page-13");
    const histories = workAHistories(fake);
    expect(histories).toHaveLength(1);
    expect(askedFor(histories[0]).sort()).toEqual(["old-3-7", "old-9-1"]);
    expect(lines).toEqual([]);
  });

  it("splits more than 25 active branches into several history requests", async () => {
    const nodes = Array.from({ length: 30 }, (_, i) => listed(`feat-${i}`, ACTIVE));
    const { fake } = await load(bigWorkRepo(() => ({ nodes, next: null })));
    const histories = workAHistories(fake);
    expect(histories.map((c) => askedFor(c).length).sort((a, b) => a - b)).toEqual([5, 25]);
  });

  it("skips a branch that was deleted after it was listed", async () => {
    const nodes = [listed("keep", ACTIVE), listed("gone", ACTIVE)];
    const { activity } = await load(
      bigWorkRepo(
        () => ({ nodes, next: null }),
        (branch) => (branch === "gone" ? null : historyOf("d".repeat(40))),
      ),
    );
    const shas = activity.commits.map((c) => c.sha);
    expect(shas).toContain("d".repeat(40));
  });

  it("cuts the branch list at the safety cap, logs it, and still loads", async () => {
    const nodes = Array.from({ length: 100 }, (_, i) => listed(`b${i}`, OLD));
    const { fake, lines } = await load(bigWorkRepo(() => ({ nodes, next: "more" })));
    expect(lines).toContain("[github] branch list cut at 5000 branches of :repo");
    expect(branchCalls(fake).filter((c) => c.variables.after === "more")).toHaveLength(49);
  });

  it("does not depend on the order GitHub returns branches in", async () => {
    const { fake } = await load();
    expect(branchCalls(fake).every((c) => !c.query.includes("orderBy"))).toBe(true);
    expect(historyCalls(fake).every((c) => !c.query.includes("orderBy"))).toBe(true);
  });
});
