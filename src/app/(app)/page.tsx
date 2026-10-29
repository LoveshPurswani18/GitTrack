import { connection } from "next/server";
import { cache, Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { UpdatedAgo } from "@/components/dashboard/UpdatedAgo";
import { getDashboardData } from "@/lib/github/dashboard";

// The title row and the dashboard both need the data; this makes them share one load per request.
const loadDashboard = cache(getDashboardData);

export default function Home() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-title">Activity</h1>
          <p className="text-body text-text-secondary">
            Commits and pull requests across personal and work repos.
          </p>
        </div>
        <Suspense fallback={null}>
          <Updated />
        </Suspense>
      </div>
      <div className="mt-6">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardData />
        </Suspense>
      </div>
    </main>
  );
}

// Fixture dates are relative to now, so this is rendered per request, not at build time.
async function Updated() {
  await connection();
  const result = await loadDashboard();
  if (result.status === "error") return null;
  return <UpdatedAgo fetchedAt={result.activity.fetchedAt} />;
}

async function DashboardData() {
  await connection();
  return <DashboardView result={await loadDashboard()} />;
}
