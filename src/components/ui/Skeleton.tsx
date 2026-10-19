import type { ReactNode } from "react";
import { cx } from "./cx";

/** Static placeholder block (no shimmer). Size it with `className`. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("rounded-[6px] bg-skeleton", className)} />;
}

export function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      {children}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4 sm:px-6 sm:py-5">
      <Skeleton className="h-3.5 w-[110px]" />
      <Skeleton className="h-9 w-[72px]" />
      <Skeleton className="h-3 w-[120px]" />
    </div>
  );
}

export function HeatmapSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4 sm:p-6">
      <Skeleton className="h-5 w-[120px]" />
      <Skeleton className="h-[102px] w-full" />
    </div>
  );
}
