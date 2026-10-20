"use client";

import { useState } from "react";
import { repoLabels } from "@/lib/format";
import type { ProjectCount } from "@/lib/metrics/projects";
import { Button } from "./Button";
import { WorkTag } from "./WorkTag";

export function SeriesLegend() {
  return (
    <div className="text-caption flex items-center gap-3 text-text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-series-personal" />
        Personal
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-series-work" />
        Work
      </span>
    </div>
  );
}

const ROW = "grid grid-cols-[minmax(0,1fr)_96px_48px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_120px_56px]";

export function ProjectList({ items, limit = 8 }: { items: ProjectCount[]; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, limit);
  // Scale against the largest count rather than assuming the caller sorted the list.
  const top = Math.max(0, ...items.map((item) => item.count));
  // Labels are worked out over the whole list, so a collision hidden behind "Show all" still counts.
  const labels = repoLabels(items.map((item) => item.repo));

  return (
    <div>
      <ul className="border-t border-border">
        {shown.map((item) => (
          <li key={item.repo} className={`${ROW} border-b border-border py-3`}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-body truncate text-text-primary" title={item.repo}>
                {labels.get(item.repo)}
              </span>
              {item.isWork && <WorkTag />}
            </span>
            <span aria-hidden="true" className="h-1.5 rounded-full bg-surface-hover">
              <span
                className={`block h-full rounded-full ${item.isWork ? "bg-series-work" : "bg-series-personal"}`}
                style={{ width: `${top ? (item.count / top) * 100 : 0}%` }}
              />
            </span>
            <span className="text-metric-sm text-right text-text-primary">{item.count}</span>
          </li>
        ))}
      </ul>
      {!showAll && items.length > limit && (
        <Button variant="ghost" className="mt-2" onClick={() => setShowAll(true)}>
          Show all {items.length}
        </Button>
      )}
    </div>
  );
}
