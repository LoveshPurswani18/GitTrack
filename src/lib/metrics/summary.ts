import type { Commit } from "@/types/activity";
import { addDays, startOfWeek, toLocalDay } from "./days";
import { type DayBounds, inBounds } from "./range";

function countInBounds(commits: Commit[], timeZone: string, bounds: DayBounds): number {
  return commits.filter((c) => inBounds(toLocalDay(c.authoredAt, timeZone), bounds)).length;
}

export function commitsToday(commits: Commit[], timeZone: string, now: Date): number {
  const today = toLocalDay(now, timeZone);
  return countInBounds(commits, timeZone, { start: today, end: today });
}

export function totalInRange(commits: Commit[], timeZone: string, bounds: DayBounds): number {
  return countInBounds(commits, timeZone, bounds);
}

/**
 * Monday → today against the same span a week earlier (Monday → the same weekday),
 * so the comparison is fair early in the week.
 */
export function thisWeekVsLast(
  commits: Commit[],
  timeZone: string,
  now: Date,
): { thisWeek: number; lastWeek: number; delta: number } {
  const today = toLocalDay(now, timeZone);
  const thisBounds = { start: startOfWeek(today), end: today };
  const lastBounds = { start: addDays(thisBounds.start, -7), end: addDays(today, -7) };
  const thisWeek = countInBounds(commits, timeZone, thisBounds);
  const lastWeek = countInBounds(commits, timeZone, lastBounds);
  return { thisWeek, lastWeek, delta: thisWeek - lastWeek };
}
