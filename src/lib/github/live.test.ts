import { describe, expect, it } from "vitest";
import { createFakeFetch, jsonResponse, type FakeRequest } from "@/test/fakeFetch";
import { dailyCounts, filterByScope, rangeBounds } from "@/lib/metrics";
import { createGitHubClient } from "./client";
import { fetchLiveActivity, fetchLiveProfile } from "./live";
import activityRaw from "./fixtures/raw/graphql-activity.json";
import prPage2Raw from "./fixtures/raw/graphql-pr-page-2.json";
import gittrackPage1 from "./fixtures/raw/rest-commits-gittrack-page-1.json";
import gittrackPage2 from "./fixtures/raw/rest-commits-gittrack-page-2.json";
import workA from "./fixtures/raw/rest-commits-work-repo-a.json";
import workB from "./fixtures/raw/rest-commits-work-repo-b.json";
import emptyRepo from "./fixtures/raw/rest-empty-repo-409.json";
import userRaw from "./fixtures/raw/rest-user.json";

const NOW = new Date("2026-10-14T12:00:00Z");
const WORK_ORG = "work-org";

function route(request: FakeRequest): Response {
  const { url } = request;
  if (url.endsWith("/graphql")) {
    const { variables } = JSON.parse(request.body!) as { variables: { after?: string } };
    return jsonResponse(variables.after === "cursor-1" ? prPage2Raw : activityRaw);
  }
  if (url.includes("/repos/demo-user/gittrack/commits")) {
    if (url.includes("page=2")) return jsonResponse(gittrackPage2);
    return jsonResponse(gittrackPage1, {
      headers: { link: '<https://api.github.com/repos/demo-user/gittrack/commits?page=2>; rel="next"' },
    });
  }
  if (url.includes("/repos/Work-Org/work-repo-a/commits")) return jsonResponse(workA);
  if (url.includes("/repos/Work-Org/work-repo-b/commits")) return jsonResponse(workB);
  if (url.includes("/repos/demo-user/empty-repo/commits")) return jsonResponse(emptyRepo, { status: 409 });
  if (url.endsWith("/users/demo-user")) return jsonResponse(userRaw);
  return jsonResponse({ message: `unexpected request: ${url}` }, { status: 404 });
}

function setup(handler: (request: FakeRequest) => Response = route) {
  const fake = createFakeFetch(handler);
  const client = createGitHubClient({ token: "ghp_testtoken", fetchImpl: fake.fetch, now: () => NOW });
  return { fake, client };
}

async function load(handler?: (request: FakeRequest) => Response) {
  const { fake, client } = setup(handler);
  const activity = await fetchLiveActivity({ username: "demo-user", workOrg: WORK_ORG, client, now: NOW });
  return { activity, fake };
}

describe("fetchLiveActivity", () => {
  it("builds the fetch window from the injected now (364 days)", async () => {
    const { activity } = await load();
    expect(activity.username).toBe("demo-user");
    expect(activity.windowStart).toBe("2025-10-15T12:00:00.000Z");
    expect(activity.windowEnd).toBe("2026-10-14T12:00:00.000Z");
    expect(activity.fetchedAt).toBe("2026-10-14T12:00:00.000Z");
  });

  it("lists commit repos and PR-only repos, flagging work repos", async () => {
    const { activity } = await load();
    expect(activity.repos.map((r) => [r.nameWithOwner, r.isWork])).toEqual([
      ["demo-user/gittrack", false],
      ["Work-Org/work-repo-a", true],
      ["Work-Org/work-repo-b", true],
      ["demo-user/forked-lib", false],
      ["demo-user/empty-repo", false],
      ["demo-user/no-branch", false],
      ["other-org/oss-project", false], // only from a pull request
    ]);
  });

  it("fetches commits only for repos that can have them", async () => {
    const { fake } = await load();
    const restUrls = fake.requests.map((r) => r.url).filter((u) => u.includes("/commits"));
    expect(restUrls.some((u) => u.includes("forked-lib"))).toBe(false); // fork
    expect(restUrls.some((u) => u.includes("no-branch"))).toBe(false); // no default branch
    expect(restUrls.some((u) => u.includes("oss-project"))).toBe(false); // PR-only repo
    expect(restUrls.some((u) => u.includes("empty-repo"))).toBe(true); // 409 → no commits
  });

  it("asks REST for my commits on the default branch with a widened range", async () => {
    const { fake } = await load();
    const search = (needle: string) =>
      new URL(fake.requests.find((r) => r.url.includes(needle))!.url).searchParams;
    const gittrack = search("demo-user/gittrack/commits");
    expect(gittrack.get("author")).toBe("demo-user");
    expect(gittrack.get("sha")).toBe("main");
    expect(gittrack.get("per_page")).toBe("100");
    expect(gittrack.get("since")).toBe("2025-10-12T12:00:00.000Z"); // window start − 3 days
    expect(gittrack.get("until")).toBe("2026-10-17T12:00:00.000Z"); // window end + 3 days
    expect(search("work-repo-b/commits").get("sha")).toBe("develop");
  });

  it("collects commits across pages and repos, by author date, oldest first", async () => {
    const { activity } = await load();
    expect(activity.commits.map((c) => [c.sha.slice(0, 2), c.repo, c.authoredAt])).toEqual([
      ["a3", "demo-user/gittrack", "2026-10-10T19:30:00.000Z"],
      ["c1", "Work-Org/work-repo-b", "2026-10-11T04:00:00.000Z"],
      ["a2", "demo-user/gittrack", "2026-10-12T20:00:00.000Z"],
      ["b1", "Work-Org/work-repo-a", "2026-10-13T05:00:00.000Z"],
      ["a1", "demo-user/gittrack", "2026-10-13T10:00:00.000Z"],
    ]);
  });

  it("reads pull requests across both pages", async () => {
    const { activity, fake } = await load();
    expect(activity.pullRequests.map((p) => [p.number, p.state])).toEqual([
      [12, "closed"],
      [41, "merged"],
      [3, "open"],
      [7, "open"],
    ]);
    const graphqlCalls = fake.requests.filter((r) => r.url.endsWith("/graphql"));
    expect(graphqlCalls).toHaveLength(2);
    expect(JSON.parse(graphqlCalls[1].body!).variables.after).toBe("cursor-1");
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
      request.url.includes("work-repo-a/commits")
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

  it("fits the metrics library: scope filter and IST vs UTC days", async () => {
    const { activity } = await load();
    const bounds = rangeBounds("1w", NOW, "Asia/Kolkata");

    const work = filterByScope(activity, "work");
    expect(work.commits.map((c) => c.sha.slice(0, 2))).toEqual(["c1", "b1"]);
    expect(work.pullRequests.map((p) => p.number)).toEqual([12, 41]);
    // The PR-only repo is in `repos`, so its PR is kept rather than dropped.
    expect(filterByScope(activity, "personal").pullRequests.map((p) => p.number)).toEqual([3, 7]);

    // The 01:00 IST commit (10 Oct 19:30Z) is 11 Oct in IST, 10 Oct in UTC.
    const ist = dailyCounts(activity.commits, "Asia/Kolkata", bounds);
    expect(ist.get("2026-10-11")).toBe(2); // 01:00 IST commit + a 09:30 IST commit
    const utc = dailyCounts(activity.commits, "UTC", rangeBounds("1w", NOW, "UTC"));
    expect(utc.get("2026-10-10")).toBe(1);
    expect(utc.get("2026-10-11")).toBe(1);
  });
});

describe("fetchLiveProfile", () => {
  it("loads and maps the user", async () => {
    const { client, fake } = setup();
    const profile = await fetchLiveProfile({ username: "demo-user", client });
    expect(profile.login).toBe("demo-user");
    expect(profile.publicRepos).toBe(27);
    expect(fake.requests).toHaveLength(1);
  });
});
