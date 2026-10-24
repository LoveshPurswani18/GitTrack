import type { ReactNode } from "react";
import { cx } from "./cx";

/** Placeholder block that pulses softly (static under reduced motion). Size it with `className`. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx("skeleton-block rounded-sm bg-skeleton", className)} />
  );
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
      {/* The real grid plus its py-1: 90px at 10px cells, 110px at 12px cells. */}
      <Skeleton className="h-[90px] w-full sm:h-[110px]" />
    </div>
  );
}

/** The profile card's shape: avatar circle, name, handle, bio, meta row, counts and the button. */
export function ProfileCardSkeleton() {
  return (
    <div className="flex flex-wrap gap-8 rounded-md border border-border bg-surface p-8">
      <div
        aria-hidden="true"
        className="skeleton-block h-16 w-16 rounded-full bg-skeleton sm:h-24 sm:w-24"
      />
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-full max-w-[420px]" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-9 w-36 sm:h-8" />
      </div>
    </div>
  );
}
