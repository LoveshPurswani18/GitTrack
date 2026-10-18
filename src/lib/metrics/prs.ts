import type { PullRequest } from "@/types/activity";
import { toLocalDay } from "./days";
import { type DayBounds, inBounds } from "./range";

export type PrStats = { opened: number; openNow: number; merged: number };

/** Opened (by createdAt) and merged (by mergedAt) fall in range; openNow ignores the range. */
export function prStats(prs: PullRequest[], timeZone: string, bounds: DayBounds): PrStats {
  return {
    opened: prs.filter((p) => inBounds(toLocalDay(p.createdAt, timeZone), bounds)).length,
    openNow: prs.filter((p) => p.state === "open").length,
    merged: prs.filter((p) => p.mergedAt && inBounds(toLocalDay(p.mergedAt, timeZone), bounds))
      .length,
  };
}

/** PRs opened in range, newest first. */
export function recentPrs(
  prs: PullRequest[],
  timeZone: string,
  bounds: DayBounds,
  limit = 5,
): PullRequest[] {
  return prs
    .filter((p) => inBounds(toLocalDay(p.createdAt, timeZone), bounds))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
