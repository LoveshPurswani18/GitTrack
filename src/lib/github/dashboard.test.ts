import { describe, expect, it } from "vitest";
import { activity } from "@/test/factories";
import type { Activity } from "@/types/activity";
import { fixtureDashboard, resolveDashboard, toActivityView, toDashboardError, type SnapshotStore } from "./dashboard";
import { GitHubError } from "./errors";

const NOW = new Date("2026-10-20T10:00:00Z");

function memory(initial: Activity | null = null): SnapshotStore & { saved: Activity | null } {
  const store = {
    saved: initial,
    get: () => store.saved,
    set: (a: Activity) => {
      store.saved = a;
    },
  };
  return store;
}

describe("toDashboardError", () => {
  it("never passes GitHub's own text, or a repo name, to the browser", () => {
    const error = new GitHubError("token", "GitHub refused access (403): Resource not accessible by org/private-repo");
    expect(toDashboardError(error)).toEqual({ kind: "token", message: "GitHub rejected the token", resetAt: undefined });
    expect(JSON.stringify(toDashboardError(error))).not.toContain("private-repo");
  });
});

describe("toActivityView", () => {
  it("keeps only what the dashboard reads", () => {
    const full = activity();
    const view = toActivityView(full);
    expect(Object.keys(view).sort()).toEqual(["commits", "fetchedAt", "pullRequests", "repos"]);
    expect(view.commits).toHaveLength(full.commits.length);
    for (const commit of view.commits) expect(Object.keys(commit).sort()).toEqual(["authoredAt", "repo"]);
    for (const repo of view.repos) expect(Object.keys(repo).sort()).toEqual(["isWork", "nameWithOwner", "url"]);
  });

  it("leaves no sha, branch flag, cross-check, window bound or username in the payload", () => {
    const json = JSON.stringify(toActivityView(activity()));
    for (const field of ["sha", "onDefault", "crossCheck", "supersededCommits", "windowStart", "windowEnd", "restrictedCount", "defaultBranch", "isPrivate", "username"]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});

describe("resolveDashboard", () => {
  it("returns ok and remembers the data", async () => {
    const fresh = activity();
    const store = memory();
    const result = await resolveDashboard(async () => fresh, store);
    expect(result).toEqual({ status: "ok", activity: toActivityView(fresh) });
    expect(store.saved).toBe(fresh);
  });

  it("returns stale, with the last good data, when a refresh hits the rate limit", async () => {
    const cached = activity();
    const store = memory(cached);
    const resetAt = "2026-10-20T10:30:00.000Z";
    const result = await resolveDashboard(async () => {
      throw new GitHubError("rate_limit", "GitHub rate limit reached", { resetAt });
    }, store);
    expect(result).toEqual({
      status: "stale",
      activity: toActivityView(cached),
      error: { kind: "rate_limit", message: "GitHub rate limit reached", resetAt },
    });
  });

  it("keeps the last good data for a token error too", async () => {
    const cached = activity();
    const result = await resolveDashboard(async () => {
      throw new GitHubError("token", "GitHub rejected the token (401)");
    }, memory(cached));
    expect(result.status).toBe("stale");
  });

  it("returns error when nothing is cached", async () => {
    const result = await resolveDashboard(async () => {
      throw new GitHubError("network", "Could not reach GitHub");
    }, memory());
    expect(result).toEqual({
      status: "error",
      error: { kind: "network", message: "Could not reach GitHub", resetAt: undefined },
    });
  });

  it("rethrows anything that is not a GitHubError", async () => {
    await expect(
      resolveDashboard(async () => {
        throw new Error("Missing environment variables for live mode: GITHUB_TOKEN");
      }, memory(activity())),
    ).rejects.toThrow("Missing environment variables");
  });
});

describe("fixtureDashboard", () => {
  it("is ok by default and for the empty fixture", async () => {
    expect((await fixtureDashboard(null, NOW)).status).toBe("ok");
    const empty = await fixtureDashboard("empty", NOW);
    expect(empty.status === "ok" && empty.activity.commits).toEqual([]);
  });

  it("shows cached data from 27 minutes earlier for a rate limit, with a reset 30 minutes ahead", async () => {
    const result = await fixtureDashboard("rate_limit", NOW);
    if (result.status !== "stale") throw new Error(`expected stale, got ${result.status}`);
    expect(result.error.kind).toBe("rate_limit");
    expect(result.error.resetAt).toBe("2026-10-20T10:30:00.000Z");
    expect(result.activity.fetchedAt).toBe("2026-10-20T09:33:00.000Z");
  });

  it("has nothing cached for a token error", async () => {
    const result = await fixtureDashboard("token_error", NOW);
    expect(result.status).toBe("error");
    expect(result.status === "error" && result.error.kind).toBe("token");
  });
});
