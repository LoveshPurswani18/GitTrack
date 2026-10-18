import type { Commit } from "@/types/activity";
import { activeDays } from "./daily";
import { addDays, toLocalDay } from "./days";

/**
 * Consecutive active days ending today, or yesterday if today has no commits yet.
 * Uses every commit passed in, so it is capped by the 365-day fetch window.
 */
export function currentStreak(commits: Commit[], timeZone: string, now: Date): number {
  const active = activeDays(commits, timeZone);
  const today = toLocalDay(now, timeZone);
  let day = active.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (active.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** Longest run of consecutive active days in the commits passed in (the fetch window). */
export function longestStreak(commits: Commit[], timeZone: string): number {
  const days = [...activeDays(commits, timeZone)].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}
