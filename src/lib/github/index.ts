import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getConfig } from "@/lib/config";
import type { Activity } from "@/types/activity";
import type { Profile } from "@/types/profile";
import { createGitHubClient } from "./client";
import {
  GitHubError,
  deserializeError,
  redactForLog,
  serializeError,
  type SerializedGitHubError,
} from "./errors";
import { loadFixtureActivity, loadFixtureProfile } from "./fixtures";
import { fetchLiveActivity, fetchLiveProfile } from "./live";

/** Live data is fresh for 15 minutes; after that it is served stale while it refreshes. */
const LIVE_LIFETIME = { stale: 300, revalidate: 900, expire: 3600 };

/**
 * What the cached live functions return. A failure is returned as plain data, not thrown, so it
 * can be given a short cache life: a rejected token or a rate limit must not stick for 15 minutes.
 */
type Cached<T> = { ok: true; data: T } | { ok: false; error: SerializedGitHubError };

async function attempt<T>(name: string, run: () => Promise<T>): Promise<Cached<T>> {
  const started = Date.now();
  const seconds = () => ((Date.now() - started) / 1000).toFixed(1);
  try {
    const data = await run();
    console.info(`[github] live ${name} ok in ${seconds()}s`);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof GitHubError) {
      console.error(
        `[github] live ${name} failed after ${seconds()}s: ${error.kind} - ${redactForLog(error.message)}`,
      );
      return { ok: false, error: serializeError(error) };
    }
    throw error; // misconfiguration and bugs surface through error.tsx, uncached
  }
}

function unwrap<T>(result: Cached<T>): T {
  if (result.ok) return result.data;
  throw deserializeError(result.error);
}

function liveClient() {
  const { token, username, workOrg } = getConfig();
  // parseConfig has already thrown in live mode if any of these were missing.
  return { client: createGitHubClient({ token: token! }), username: username!, workOrg: workOrg! };
}

async function getLiveActivity(): Promise<Cached<Activity>> {
  "use cache";
  cacheTag("github");
  const result = await attempt("activity", () => fetchLiveActivity({ ...liveClient(), now: new Date() }));
  if (result.ok) cacheLife(LIVE_LIFETIME);
  else cacheLife("seconds");
  return result;
}

async function getLiveProfile(): Promise<Cached<Profile>> {
  "use cache";
  cacheTag("github");
  const result = await attempt("profile", () => {
    const { client, username } = liveClient();
    return fetchLiveProfile({ client, username, now: new Date() });
  });
  if (result.ok) cacheLife(LIVE_LIFETIME);
  else cacheLife("seconds");
  return result;
}

export async function getActivity(): Promise<Activity> {
  const config = getConfig();
  if (config.dataSource === "live") return unwrap(await getLiveActivity());
  return loadFixtureActivity(config.fixtureState, new Date());
}

export async function getProfile(): Promise<Profile> {
  const config = getConfig();
  if (config.dataSource === "live") return unwrap(await getLiveProfile());
  return loadFixtureProfile(config.fixtureState, new Date());
}
