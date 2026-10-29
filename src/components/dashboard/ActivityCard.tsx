import { Heatmap, HeatmapLegend } from "@/components/ui/Heatmap";
import type { Cell } from "@/lib/metrics/heatmap";

export type HeatmapData = {
  weeks: (Cell | null)[][];
  total: number;
  today: string;
};

/** Heading for the empty state: "No commits in the last 7 days" (DESIGN.md §8). */
const EMPTY_TITLE: Record<string, string> = {
  today: "No commits today",
  "1w": "No commits in the last 7 days",
  "1m": "No commits in the last 30 days",
  "6m": "No commits in the last 6 months",
  "1y": "No commits in the last year",
};

export function ActivityCard({
  heatmap,
  range,
  rangeLabel,
  tz,
  cachedAt,
}: {
  heatmap: HeatmapData;
  range: string;
  rangeLabel: string;
  tz: string;
  /** "14:05" when old data is shown after a failed refresh; replaces the timezone in the caption. */
  cachedAt?: string;
}) {
  const { weeks, total, today } = heatmap;
  return (
    <section
      aria-label="Activity"
      className="rounded-md border border-border bg-surface p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-heading text-text-primary">Activity</h2>
        <p className="text-caption text-text-muted">
          <span className="text-metric-sm">{total}</span> commits
          <span className="hidden sm:inline">
            {" "}
            · {rangeLabel} · {cachedAt ? `cached at ${cachedAt}` : tz}
          </span>
        </p>
      </div>
      {total === 0 ? (
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="font-semibold text-text-primary">{EMPTY_TITLE[range]}</p>
          <p className="text-text-secondary">Try a longer range, like 6 months.</p>
        </div>
      ) : (
        <>
          <Heatmap weeks={weeks} today={today} ariaLabel={`Commit activity, ${rangeLabel}`} />
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-caption hidden text-text-muted sm:block">
              Levels are quartiles of your active days in this range.
            </p>
            <div className="ml-auto">
              <HeatmapLegend />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
