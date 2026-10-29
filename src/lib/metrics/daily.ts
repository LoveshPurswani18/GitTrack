import type { CommitStamp } from "@/types/activity";
import { dayRange, toLocalDay } from "./days";
import type { DayBounds } from "./range";

/** Commits per local day across the bounds, zero-filled and in date order. */
export function dailyCounts(
  commits: CommitStamp[],
  timeZone: string,
  bounds: DayBounds,
): Map<string, number> {
  const counts = new Map(dayRange(bounds.start, bounds.end).map((day) => [day, 0]));
  for (const commit of commits) {
    const day = toLocalDay(commit.authoredAt, timeZone);
    const current = counts.get(day);
    if (current !== undefined) counts.set(day, current + 1);
  }
  return counts;
}

/** Local days with at least one commit. */
export function activeDays(commits: CommitStamp[], timeZone: string): Set<string> {
  return new Set(commits.map((c) => toLocalDay(c.authoredAt, timeZone)));
}
