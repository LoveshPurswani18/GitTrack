"use client";

import { useMemo, useState } from "react";
import { formatClock } from "@/lib/format";
import { controlsToSearch, parseControls, rangeLabel, type Controls } from "@/lib/controls";
import {
  commitsByRepo,
  commitsToday,
  currentStreak,
  dailyCounts,
  filterByScope,
  heatmapGrid,
  longestStreak,
  prStats,
  recentPrs,
  rangeBounds,
  thisWeekVsLast,
  totalInRange,
} from "@/lib/metrics";
import type { Activity } from "@/types/activity";
import { ActivityCard, type HeatmapData } from "./ActivityCard";
import { ControlBar } from "./ControlBar";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { ProjectsCard } from "./ProjectsCard";
import { PullRequestsCard } from "./PullRequestsCard";
import { StatsRow, type Stats } from "./StatsRow";
import { useClientEnvironment, type ClientEnvironment } from "./useClientEnvironment";

/**
 * Holds range, repos and timezone and recomputes every number from the one Activity the server
 * sent, so changing a control never touches the network. The timezone and clock only exist in
 * the browser, so a skeleton shows until they are known.
 */
export function Dashboard({
  activity,
  cachedAtIso,
}: {
  activity: Activity;
  /** Set when this is old data shown after a failed refresh. */
  cachedAtIso?: string;
}) {
  const env = useClientEnvironment();
  if (!env) return <DashboardSkeleton />;
  return <DashboardContent activity={activity} env={env} cachedAtIso={cachedAtIso} />;
}

function DashboardContent({
  activity,
  env,
  cachedAtIso,
}: {
  activity: Activity;
  env: ClientEnvironment;
  cachedAtIso?: string;
}) {
  const { now, browserZone } = env;
  const cachedAt = cachedAtIso ? formatClock(cachedAtIso, browserZone) : undefined;
  const [controls, setControls] = useState<Controls>(() =>
    parseControls(window.location.search, browserZone),
  );

  function update(patch: Partial<Controls>) {
    const next = { ...controls, ...patch };
    setControls(next);
    window.history.replaceState(null, "", controlsToSearch(next));
  }

  const { stats, heatmap, projects, prs, recent, repos } = useMemo(() => {
    const { range, scope, tz } = controls;
    const filtered = filterByScope(activity, scope);
    const { commits } = filtered;
    const week = thisWeekVsLast(commits, tz, now);
    const bounds = rangeBounds(range, now, tz);
    const total = totalInRange(commits, tz, bounds);
    const stats: Stats = {
      today: commitsToday(commits, tz, now),
      thisWeek: week.thisWeek,
      delta: week.delta,
      // Streaks look at every commit in the scope, not just the selected range.
      streak: currentStreak(commits, tz, now),
      longest: longestStreak(commits, tz),
      total,
    };
    const heatmap: HeatmapData = {
      weeks: heatmapGrid(dailyCounts(commits, tz, bounds), bounds).weeks,
      total,
      today: bounds.end,
    };
    return {
      stats,
      heatmap,
      projects: commitsByRepo(filtered, tz, bounds),
      prs: prStats(filtered.pullRequests, tz, bounds),
      recent: recentPrs(filtered.pullRequests, tz, bounds),
      repos: filtered.repos,
    };
  }, [activity, controls, now]);

  return (
    <div className="flex flex-col gap-6">
      <ControlBar controls={controls} onChange={update} browserZone={browserZone} />
      <StatsRow
        stats={stats}
        rangeLabel={rangeLabel(controls.range)}
        tz={controls.tz}
        cachedAt={cachedAt}
      />
      <ActivityCard
        heatmap={heatmap}
        range={controls.range}
        rangeLabel={rangeLabel(controls.range)}
        tz={controls.tz}
        cachedAt={cachedAt}
      />
      <div className="flex flex-wrap gap-6">
        <PullRequestsCard stats={prs} recent={recent} repos={repos} tz={controls.tz} />
        <ProjectsCard projects={projects} />
      </div>
    </div>
  );
}
