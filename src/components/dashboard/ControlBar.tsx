"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TimezoneSelect } from "@/components/ui/TimezoneSelect";
import { RANGE_OPTIONS, SCOPE_OPTIONS, type Controls } from "@/lib/controls";

/**
 * Range, repos, timezone and refresh. Stacked on mobile (range, repos, then timezone beside a
 * 44px icon button); one row on desktop with timezone and refresh pushed right.
 */
export function ControlBar({
  controls,
  onChange,
  browserZone,
}: {
  controls: Controls;
  onChange: (patch: Partial<Controls>) => void;
  browserZone: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <SegmentedControl
        aria-label="Range"
        options={RANGE_OPTIONS}
        value={controls.range}
        onChange={(range) => onChange({ range })}
      />
      <SegmentedControl
        aria-label="Repos"
        options={SCOPE_OPTIONS}
        value={controls.scope}
        onChange={(scope) => onChange({ scope })}
      />
      <div className="flex gap-2 sm:ml-auto">
        <TimezoneSelect
          className="flex-1 sm:flex-none"
          value={controls.tz}
          onChange={(tz) => onChange({ tz })}
          browserZone={browserZone}
        />
        {/* Refresh does nothing yet: the server action and "Refreshing…" state come in task 3.1. */}
        <span className="sm:hidden">
          <Button iconOnly icon={RefreshCw} aria-label="Refresh" />
        </span>
        <span className="hidden sm:block">
          <Button icon={RefreshCw}>Refresh</Button>
        </span>
      </div>
    </div>
  );
}
