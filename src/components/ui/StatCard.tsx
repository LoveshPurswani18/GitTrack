import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export function StatCard({
  label,
  shortLabel,
  icon: Icon,
  iconClassName = "text-text-muted",
  value,
  unit,
  delta,
  deltaLabel,
  context,
}: {
  label: string;
  /** Shown instead of `label` under 640px. */
  shortLabel?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  value: number;
  unit?: string;
  /** Signed change; positive reads green, negative stays muted. Rendered before `deltaLabel`. */
  delta?: number;
  deltaLabel?: ReactNode;
  context?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4 sm:px-6 sm:py-5">
      <div className="text-label flex items-center gap-1 text-text-muted">
        {Icon && <Icon size={16} strokeWidth={1.5} aria-hidden="true" className={iconClassName} />}
        {shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cx(
            "text-metric-lg sm:text-metric-xl",
            value === 0 ? "text-text-muted" : "text-text-primary",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-body text-text-muted">{unit}</span>}
      </div>
      {delta !== undefined && (
        <p className="text-caption text-text-muted">
          <span className={cx("text-metric-sm", delta > 0 && "text-accent-text")}>
            {delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0"}
          </span>{" "}
          {deltaLabel}
        </p>
      )}
      {context && <p className="text-caption text-text-muted">{context}</p>}
    </div>
  );
}
