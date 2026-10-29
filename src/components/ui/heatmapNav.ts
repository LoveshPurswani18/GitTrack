import type { Cell } from "@/lib/metrics/heatmap";

export type Pos = { w: number; d: number };
export type NavKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

type Weeks = (Cell | null)[][];

const has = (weeks: Weeks, w: number, d: number) => Boolean(weeks[w]?.[d]);

/** Every real (non-null) cell in reading order: week by week, Monday first. */
function inOrder(weeks: Weeks): Pos[] {
  const all: Pos[] = [];
  weeks.forEach((week, w) => week.forEach((cell, d) => cell && all.push({ w, d })));
  return all;
}

/**
 * Where an arrow key, Home or End moves focus. Up/Down step one day (crossing into the
 * neighbouring week), Left/Right step one week in the same weekday row. Empty cells are
 * skipped; at an edge, or when the target is empty, focus stays put (returns null).
 */
export function nextCell(weeks: Weeks, from: Pos, key: NavKey): Pos | null {
  const all = inOrder(weeks);
  if (all.length === 0) return null;
  if (key === "Home") return all[0];
  if (key === "End") return all[all.length - 1];

  if (key === "ArrowLeft" || key === "ArrowRight") {
    const w = from.w + (key === "ArrowRight" ? 1 : -1);
    return has(weeks, w, from.d) ? { w, d: from.d } : null;
  }

  const index = all.findIndex((p) => p.w === from.w && p.d === from.d);
  const next = all[index + (key === "ArrowDown" ? 1 : -1)];
  return index === -1 ? null : (next ?? null);
}
