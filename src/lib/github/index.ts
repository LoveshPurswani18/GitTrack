import "server-only";

import { getConfig } from "@/lib/config";
import type { Activity } from "@/types/activity";
import type { Profile } from "@/types/profile";
import { loadFixtureActivity, loadFixtureProfile } from "./fixtures";

function liveNotReady(): never {
  throw new Error("GITHUB_DATA=live is not implemented yet (task 1.4)");
}

export async function getActivity(): Promise<Activity> {
  const config = getConfig();
  if (config.dataSource === "live") liveNotReady();
  return loadFixtureActivity(config.fixtureState, new Date());
}

export async function getProfile(): Promise<Profile> {
  const config = getConfig();
  if (config.dataSource === "live") liveNotReady();
  return loadFixtureProfile(config.fixtureState, new Date());
}
