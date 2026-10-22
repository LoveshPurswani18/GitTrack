"use client";

import { useEffect, useRef } from "react";
import type { DashboardResult } from "@/types/dashboard";
import { Dashboard } from "./Dashboard";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { NoDataCard, StateBanner } from "./States";
import { refreshClientEnvironment, useClientEnvironment } from "./useClientEnvironment";

/**
 * Picks what to show for the server's result: the dashboard, the dashboard under a banner (old
 * data after a failed refresh), or a banner with the "No data to show" card. The clock the
 * numbers use is retaken whenever new data arrives, so "today" moves on after a refresh.
 */
export function DashboardView({ result }: { result: DashboardResult }) {
  const env = useClientEnvironment();

  const arrived = result.status === "error" ? null : `${result.status}:${result.activity.fetchedAt}`;
  const previous = useRef(arrived);
  useEffect(() => {
    if (arrived !== previous.current) {
      previous.current = arrived;
      refreshClientEnvironment();
    }
  }, [arrived]);

  if (!env) return <DashboardSkeleton />;
  const tz = env.browserZone;

  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <StateBanner error={result.error} tz={tz} />
        <NoDataCard error={result.error} tz={tz} />
      </div>
    );
  }

  if (result.status === "stale") {
    const cachedAt = result.activity.fetchedAt;
    return (
      <div className="flex flex-col gap-6">
        <StateBanner error={result.error} tz={tz} cachedAtIso={cachedAt} />
        <Dashboard activity={result.activity} cachedAtIso={cachedAt} />
      </div>
    );
  }

  return <Dashboard activity={result.activity} />;
}
