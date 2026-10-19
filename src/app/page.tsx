import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { getActivity } from "@/lib/github";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1024px] px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <h1 className="text-title">Activity</h1>
      <p className="text-body text-text-secondary">
        Commits and pull requests across personal and work repos.
      </p>
      <div className="mt-6">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardData />
        </Suspense>
      </div>
    </main>
  );
}

// Fixture dates are relative to now, so this is rendered per request, not at build time.
async function DashboardData() {
  await connection();
  return <Dashboard activity={await getActivity()} />;
}
