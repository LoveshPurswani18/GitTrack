import { Skeleton, SkeletonRegion, StatCardSkeleton } from "@/components/ui/Skeleton";

/** Shown while the data streams in and until the browser's timezone is known (DESIGN.md §8). */
export function DashboardSkeleton() {
  return (
    <SkeletonRegion label="Loading activity">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Skeleton className="h-9 w-full sm:h-8 sm:w-72" />
          <Skeleton className="h-9 w-full sm:h-8 sm:w-60" />
          <Skeleton className="h-9 w-full sm:ml-auto sm:h-8 sm:w-52" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    </SkeletonRegion>
  );
}
