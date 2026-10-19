"use client";

import { useMemo, useState } from "react";
import { controlsToSearch, parseControls, rangeLabel, type Controls } from "@/lib/controls";
import {
  commitsToday,
  currentStreak,
  filterByScope,
  longestStreak,
  rangeBounds,
  thisWeekVsLast,
  totalInRange,
} from "@/lib/metrics";
import type { Activity } from "@/types/activity";
import { ControlBar } from "./ControlBar";
import { DashboardSkeleton } from "./DashboardSkeleton";
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

  const stats = useMemo<Stats>(() => {
    const { range, scope, tz } = controls;
    const { commits } = filterByScope(activity, scope);
    const week = thisWeekVsLast(commits, tz, now);
    return {
      today: commitsToday(commits, tz, now),
      thisWeek: week.thisWeek,
      delta: week.delta,
      // Streaks look at every commit in the scope, not just the selected range.
      streak: currentStreak(commits, tz, now),
      longest: longestStreak(commits, tz),
      total: totalInRange(commits, tz, rangeBounds(range, now, tz)),
    };
  }, [activity, controls, now]);

  return (
    <div className="flex flex-col gap-6">
      <ControlBar controls={controls} onChange={update} browserZone={browserZone} />
      <StatsRow stats={stats} rangeLabel={rangeLabel(controls.range)} tz={controls.tz} />
    </div>
  );
}
