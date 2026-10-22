"use server";

import { updateTag } from "next/cache";

/** Expires the cached GitHub data at once (not stale-while-revalidate), so the next render refetches. */
export async function refreshData() {
  updateTag("github");
}
