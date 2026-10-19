import type { Cell, Level } from "@/lib/metrics/heatmap";

const LEVEL_BG: Record<Level, string> = {
  0: "bg-heat-0",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
};

/**
 * Week columns, Monday first. `null` cells (outside the range) keep their slot empty.
 * Tooltip and arrow-key movement between cells come with the dashboard task (2.3).
 */
export function Heatmap({
  weeks,
  today,
  ariaLabel,
  formatLabel,
}: {
  weeks: (Cell | null)[][];
  today: string;
  ariaLabel: string;
  formatLabel: (cell: Cell) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <div role="img" aria-label={ariaLabel} className="flex w-max gap-[2px] sm:gap-[3px]">
        {weeks.map((week, w) => (
          <div key={w} className="flex flex-col gap-[2px] sm:gap-[3px]">
            {week.map((cell, d) =>
              cell ? (
                <div
                  key={cell.day}
                  title={formatLabel(cell)}
                  aria-label={formatLabel(cell)}
                  className={`h-[10px] w-[10px] rounded-[2px] sm:h-3 sm:w-3 ${LEVEL_BG[cell.level]} ${
                    cell.day === today ? "outline-[1.5px] outline-offset-1 outline-text-primary" : ""
                  }`}
                />
              ) : (
                <div key={`${w}-${d}`} className="h-[10px] w-[10px] sm:h-3 sm:w-3" />
              ),
            )}
          </div>
        ))}
      </div>
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
