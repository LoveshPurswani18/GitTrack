"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { commitCount, formatDay } from "@/lib/format";
import type { Cell, Level } from "@/lib/metrics/heatmap";
import { nextCell, type NavKey, type Pos } from "./heatmapNav";

const LEVEL_BG: Record<Level, string> = {
  0: "bg-heat-0",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
};

const NAV_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);
const CELL_SIZE = "h-[10px] w-[10px] sm:h-3 sm:w-3";

type Weeks = (Cell | null)[][];
type Tip = { text: string; x: number; y: number };

/** Today's cell, or the last day in range, is the one Tab stops on. */
function defaultPos(weeks: Weeks, today: string): Pos | null {
  let last: Pos | null = null;
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < weeks[w].length; d++) {
      const cell = weeks[w][d];
      if (!cell) continue;
      if (cell.day === today) return { w, d };
      last = { w, d };
    }
  }
  return last;
}

/**
 * Week columns, Monday first, laid out as 7 weekday rows so it is a real ARIA grid. `null` cells
 * (outside the range) keep their slot empty and cannot be focused. Arrow keys move between days
 * and weeks; the tooltip shows on hover and on focus.
 */
export function Heatmap({
  weeks,
  today,
  ariaLabel,
}: {
  weeks: Weeks;
  today: string;
  ariaLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  // The picked cell only counts for the grid it was picked in, so a new range resets it.
  const [picked, setPicked] = useState<{ weeks: Weeks; pos: Pos } | null>(null);
  const home = useMemo(() => defaultPos(weeks, today), [weeks, today]);
  const active = picked?.weeks === weeks ? picked.pos : home;

  // Start scrolled to the right so today is visible on narrow screens.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  function showTip(el: HTMLElement, cell: Cell) {
    const rect = el.getBoundingClientRect();
    const half = 80; // keeps the centred tooltip inside the viewport
    const x = Math.min(Math.max(rect.left + rect.width / 2, half), window.innerWidth - half);
    setTip({ text: `${commitCount(cell.count)} · ${formatDay(cell.day)}`, x, y: rect.top });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, pos: Pos) {
    if (!NAV_KEYS.has(event.key)) return;
    event.preventDefault();
    const target = nextCell(weeks, pos, event.key as NavKey);
    if (!target) return;
    setPicked({ weeks, pos: target });
    scroller.current
      ?.querySelector<HTMLElement>(`[data-pos="${target.w}-${target.d}"]`)
      ?.focus();
  }

  return (
    <div>
      <div ref={scroller} className="overflow-x-auto py-1" onScroll={() => setTip(null)}>
        <div role="grid" aria-label={ariaLabel} className="flex w-max flex-col gap-[2px] sm:gap-[3px]">
          {Array.from({ length: 7 }, (_, d) => (
            <div key={d} role="row" className="flex gap-[2px] sm:gap-[3px]">
              {weeks.map((week, w) => {
                const cell = week[d];
                if (!cell) {
                  return <div key={w} role="gridcell" aria-hidden="true" className={CELL_SIZE} />;
                }
                const isActive = active?.w === w && active.d === d;
                return (
                  <div
                    key={cell.day}
                    role="gridcell"
                    data-pos={`${w}-${d}`}
                    tabIndex={isActive ? 0 : -1}
                    aria-label={`${commitCount(cell.count)} on ${formatDay(cell.day)}`}
                    onKeyDown={(e) => onKeyDown(e, { w, d })}
                    onFocus={(e) => {
                      setPicked({ weeks, pos: { w, d } });
                      showTip(e.currentTarget, cell);
                    }}
                    onBlur={() => setTip(null)}
                    onMouseEnter={(e) => showTip(e.currentTarget, cell)}
                    onMouseLeave={() => setTip(null)}
                    className={`${CELL_SIZE} rounded-[2px] ${LEVEL_BG[cell.level]} ${
                      cell.day === today ? "outline-[1.5px] outline-offset-1 outline-text-primary" : ""
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {tip && (
        <div
          aria-hidden="true"
          style={{ left: tip.x, top: tip.y }}
          className="text-caption pointer-events-none fixed z-60 -mt-1.5 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-border bg-surface px-2 py-1 text-text-primary shadow-popover"
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="text-caption flex items-center gap-1 text-text-muted">
      <span>Less</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span key={level} aria-hidden="true" className={`h-[10px] w-[10px] rounded-[2px] ${LEVEL_BG[level]}`} />
      ))}
      <span>More</span>
    </div>
  );
}
