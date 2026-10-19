import { cx } from "./cx";

export type PRStatus = "open" | "merged" | "closed";

// Closed has no colour token, so it shows the word only.
const DOT: Record<PRStatus, string | null> = {
  open: "bg-pr-open",
  merged: "bg-pr-merged",
  closed: null,
};

export function PRBadge({
  label,
  count,
  status,
  className,
}: {
  label: string;
  count?: number;
  status?: PRStatus;
  className?: string;
}) {
  const dot = status ? DOT[status] : null;
  return (
    <span
      className={cx(
        "text-caption inline-flex h-6 items-center gap-1.5 rounded-sm border border-border bg-bg px-2 whitespace-nowrap text-text-secondary",
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />}
      {count !== undefined && <span className="text-metric-sm text-text-primary">{count}</span>}
      {label}
    </span>
  );
}
