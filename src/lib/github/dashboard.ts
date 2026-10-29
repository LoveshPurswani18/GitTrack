import "server-only";

import { requireSession } from "@/lib/auth/session";
import { getConfig, type FixtureState } from "@/lib/config";
import type { Activity } from "@/types/activity";
import type { DashboardResult } from "@/types/dashboard";
import { GitHubError, serializeError } from "./errors";
import { loadFixtureActivity } from "./fixtures";
import { getActivity } from "./index";

/** Where the last successful Activity is kept, so a failed refresh can still show it. */
export type SnapshotStore = { get(): Activity | null; set(activity: Activity): void };

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
    return { status: "ok", activity };
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error;
    const cached = store.get();
    const failure = serializeError(error);
    return cached
      ? { status: "stale", activity: cached, error: failure }
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
