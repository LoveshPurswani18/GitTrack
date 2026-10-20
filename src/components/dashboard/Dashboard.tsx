"use client";

import { useMemo, useState } from "react";
import { controlsToSearch, parseControls, rangeLabel, type Controls } from "@/lib/controls";
import {
  commitsByRepo,
  commitsToday,
  currentStreak,
  dailyCounts,
  filterByScope,
  heatmapGrid,
  longestStreak,
  rangeBounds,
  thisWeekVsLast,
  totalInRange,
} from "@/lib/metrics";
import type { Activity } from "@/types/activity";
import { ActivityCard, type HeatmapData } from "./ActivityCard";
import { ControlBar } from "./ControlBar";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { ProjectsCard } from "./ProjectsCard";
import { StatsRow, type Stats } from "./StatsRow";
import { useClientEnvironment, type ClientEnvironment } from "./useClientEnvironment";

/**
 * Holds range, repos and timezone and recomputes every number from the one Activity the server
 * sent, so changing a control never touches the network. The timezone and clock only exist in
 * the browser, so a skeleton shows until they are known.
 */
export function Dashboard({ activity }: { activity: Activity }) {
  const env = useClientEnvironment();
  if (!env) return <DashboardSkeleton />;
  return <DashboardContent activity={activity} env={env} />;
}

function DashboardContent({ activity, env }: { activity: Activity; env: ClientEnvironment }) {
  const { now, browserZone } = env;
  const [controls, setControls] = useState<Controls>(() =>
    parseControls(window.location.search, browserZone),
  );

  function update(patch: Partial<Controls>) {
    const next = { ...controls, ...patch };
    setControls(next);
    window.history.replaceState(null, "", controlsToSearch(next));
  }

  const { stats, heatmap, projects } = useMemo(() => {
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
    return { stats, heatmap, projects: commitsByRepo(filtered, tz, bounds) };
  }, [activity, controls, now]);

  return (
    <div className="flex flex-col gap-6">
      <ControlBar controls={controls} onChange={update} browserZone={browserZone} />
      <StatsRow stats={stats} rangeLabel={rangeLabel(controls.range)} tz={controls.tz} />
      <ActivityCard
        heatmap={heatmap}
        range={controls.range}
        rangeLabel={rangeLabel(controls.range)}
        tz={controls.tz}
      />
      <div className="flex flex-wrap gap-6">
        <ProjectsCard projects={projects} />
      </div>
    </div>
  );
}
