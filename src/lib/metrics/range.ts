import { addDays, toLocalDay } from "./days";

export type Range = "today" | "1w" | "1m" | "6m" | "1y";

/** Inclusive local-day bounds, as YYYY-MM-DD strings. */
export type DayBounds = { start: string; end: string };

export const RANGE_DAYS: Record<Range, number> = {
  today: 1,
  "1w": 7,
  "1m": 30,
  "6m": 182,
  "1y": 365,
};

/** Rolling window of RANGE_DAYS local days ending on today in the given timezone. */
export function rangeBounds(range: Range, now: Date, timeZone: string): DayBounds {
  const end = toLocalDay(now, timeZone);
  return { start: addDays(end, -(RANGE_DAYS[range] - 1)), end };
}

export function inBounds(day: string, bounds: DayBounds): boolean {
  return day >= bounds.start && day <= bounds.end;
}
