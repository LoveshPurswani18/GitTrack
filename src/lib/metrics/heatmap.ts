import { addDays, dayRange, startOfWeek } from "./days";
import { type DayBounds, inBounds } from "./range";

export type Level = 0 | 1 | 2 | 3 | 4;
export type Cell = { day: string; count: number; level: Level };
export type Thresholds = { t1: number; t2: number; t3: number; max: number };

/**
 * Quartile cut-offs over the active days (count > 0), by nearest rank on the sorted
 * counts. With no active days every threshold is 0.
 */
export function levelThresholds(counts: number[]): Thresholds {
  const sorted = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { t1: 0, t2: 0, t3: 0, max: 0 };
  const rank = (p: number) => sorted[Math.ceil(n * p) - 1];
  return { t1: rank(0.25), t2: rank(0.5), t3: rank(0.75), max: sorted[n - 1] };
}

/** 0 for no commits, otherwise 1–4. The busiest day is always 4; duplicate cut-offs are safe. */
export function level(count: number, th: Thresholds): Level {
  if (count <= 0) return 0;
  if (count >= th.max) return 4;
  const below = [th.t1, th.t2, th.t3].filter((t) => t < count).length;
  return Math.min(4, 1 + below) as Level;
}

/**
 * Week columns (Monday first, 7 rows each) from the Monday of the first day to the Monday
 * of the last. Days outside the bounds are null.
 */
export function heatmapGrid(
  daily: Map<string, number>,
  bounds: DayBounds,
): { weeks: (Cell | null)[][] } {
  const inRange = dayRange(bounds.start, bounds.end);
  const thresholds = levelThresholds(inRange.map((d) => daily.get(d) ?? 0));
  const weeks: (Cell | null)[][] = [];
  for (let monday = startOfWeek(bounds.start); monday <= bounds.end; monday = addDays(monday, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, row) => {
        const day = addDays(monday, row);
        if (!inBounds(day, bounds)) return null;
        const count = daily.get(day) ?? 0;
        return { day, count, level: level(count, thresholds) };
      }),
    );
  }
  return { weeks };
}
