"use server";

import { updateTag } from "next/cache";
import { endSession, requireSession } from "@/lib/auth/session";
import { canRefresh } from "@/lib/refreshCooldown";

let lastRefreshAt: number | null = null;

/**
 * Expires the cached GitHub data at once (not stale-while-revalidate), so the next render refetches.
 * Needs a session, and is ignored inside the 60 second cooldown: the data on screen simply stays.
 */
export async function refreshData() {
  await requireSession();
  const now = Date.now();
  if (!canRefresh(lastRefreshAt, now)) return;
  lastRefreshAt = now;
  updateTag("github");
}

/**
 * Ends the session on this browser. It is the one action that does not need a session: deleting a
 * pass that is not there changes nothing, and a visitor with no pass must still be able to leave.
 */
export async function lock() {
  await endSession();
}
