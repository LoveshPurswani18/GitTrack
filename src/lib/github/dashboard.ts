import "server-only";

import { requireSession } from "@/lib/auth/session";
import { getConfig, type FixtureState } from "@/lib/config";
import type { Activity, ActivityView } from "@/types/activity";
import type { DashboardError, DashboardResult } from "@/types/dashboard";
import { GitHubError } from "./errors";
import { loadFixtureActivity } from "./fixtures";
import { getActivity } from "./index";

/** Where the last successful Activity is kept, so a failed refresh can still show it. */
export type SnapshotStore = { get(): Activity | null; set(activity: Activity): void };

const CLIENT_MESSAGES: Record<DashboardError["kind"], string> = {
  token: "GitHub rejected the token",
  rate_limit: "GitHub rate limit reached",
  network: "Could not reach GitHub",
};

/**
 * The error as the browser sees it: the kind, the reset time and a fixed message. GitHub's own
 * text can name a private repo, so it stays in the server log.
 */
export function toDashboardError(error: GitHubError): DashboardError {
  return { kind: error.kind, message: CLIENT_MESSAGES[error.kind], resetAt: error.resetAt };
}

/**
 * Cuts an Activity down to what the dashboard shows before it is sent to the browser. Everything
 * else (shas, branch flags, cross-check counts, window bounds, token-scope hints, the username)
 * stays on the server.
 */
export function toActivityView(activity: Activity): ActivityView {
  return {
    fetchedAt: activity.fetchedAt,
    repos: activity.repos.map(({ nameWithOwner, url, isWork }) => ({ nameWithOwner, url, isWork })),
    commits: activity.commits.map(({ repo, authoredAt }) => ({ repo, authoredAt })),
    pullRequests: activity.pullRequests.map((pr) => ({
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      closedAt: pr.closedAt,
    })),
  };
}

/**
 * Runs `load` and turns the outcome into something the page can render. A GitHub failure becomes
 * `stale` when a snapshot exists (last good data plus the reason) and `error` when not. Anything
 * that is not a GitHubError (bad configuration, a bug) is rethrown for error.tsx.
 */
export async function resolveDashboard(
  load: () => Promise<Activity>,
  store: SnapshotStore,
): Promise<DashboardResult> {
  try {
    const activity = await load();
    store.set(activity);
    return { status: "ok", activity: toActivityView(activity) };
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error;
    const cached = store.get();
    const failure = toDashboardError(error);
    return cached
      ? { status: "stale", activity: toActivityView(cached), error: failure }
      : { status: "error", error: failure };
  }
}

// Kept in server memory, like the cache itself. A restart followed by a failure shows the
// "No data to show" state, which matches its wording ("Nothing is cached yet").
let lastGood: Activity | null = null;
const memoryStore: SnapshotStore = {
  get: () => lastGood,
  set: (activity) => {
    lastGood = activity;
  },
};

const FIXTURE_CACHE_AGE_MS = 27 * 60 * 1000;

/**
 * Fixtures have no real cache, so the rate-limit state pretends one exists: a normal snapshot
 * from 27 minutes earlier. The token-error state has nothing cached, as on a first load.
 */
export function fixtureDashboard(state: FixtureState | null, now: Date): Promise<DashboardResult> {
  const snapshot = {
    get: () =>
      state === "rate_limit"
        ? loadFixtureActivity(null, new Date(now.getTime() - FIXTURE_CACHE_AGE_MS))
        : null,
    set: () => {},
  };
  return resolveDashboard(async () => loadFixtureActivity(state, now), snapshot);
}

export async function getDashboardData(): Promise<DashboardResult> {
  await requireSession(); // the data layer checks the pass itself, whatever the proxy did
  const config = getConfig();
  if (config.dataSource === "fixtures") return fixtureDashboard(config.fixtureState, new Date());
  return resolveDashboard(getActivity, memoryStore);
}
