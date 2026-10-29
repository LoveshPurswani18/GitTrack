import "server-only";

import { requireSession } from "@/lib/auth/session";
import type { Profile, ProfileResult } from "@/types/profile";
import { GitHubError, serializeError } from "./errors";
import { getProfile } from "./index";

/**
 * Runs `load` and turns the outcome into something the profile page can render. A GitHub failure
 * becomes an `error` result (the page shows a banner and no card, DESIGN.md §8). Anything that is
 * not a GitHubError (bad configuration, a bug) is rethrown for error.tsx.
 */
export async function resolveProfile(load: () => Promise<Profile>): Promise<ProfileResult> {
  try {
    return { status: "ok", profile: await load() };
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error;
    return { status: "error", error: serializeError(error) };
  }
}

export async function getProfileData(): Promise<ProfileResult> {
  await requireSession(); // the data layer checks the pass itself, whatever the proxy did
  return resolveProfile(getProfile);
}
