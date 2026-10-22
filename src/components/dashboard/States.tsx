"use client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/format";
import type { DashboardError } from "@/types/dashboard";
import { useRefresh } from "./RefreshButton";
import { stateCopy } from "./stateCopy";

function copyFor(error: DashboardError, tz: string, cachedAtIso?: string) {
  return stateCopy(error, {
    cachedAt: cachedAtIso ? formatClock(cachedAtIso, tz) : undefined,
    resetAt: error.resetAt ? formatClock(error.resetAt, tz) : undefined,
  });
}

/** The banner under the page title. `cachedAtIso` is set when old data is still shown below it. */
export function StateBanner({
  error,
  tz,
  cachedAtIso,
}: {
  error: DashboardError;
  tz: string;
  cachedAtIso?: string;
}) {
  const { tone, title, detail } = copyFor(error, tz, cachedAtIso);
  return (
    <Banner tone={tone} title={title}>
      {detail}
    </Banner>
  );
}

/** Shown instead of the dashboard when a failure left nothing cached. */
export function NoDataCard({ error, tz }: { error: DashboardError; tz: string }) {
  const { noData } = copyFor(error, tz);
  const { pending, refresh } = useRefresh();
  return (
    <section
      aria-label="No data"
      className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface px-6 py-16 text-center"
    >
      <h2 className="text-heading text-text-primary">No data to show</h2>
      <p className="text-body max-w-[420px] text-text-secondary">{noData}</p>
      <Button busy={pending} busyLabel="Refreshing…" onClick={refresh}>
        Try again
      </Button>
    </section>
  );
}
