import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/ProfileView";
import { ProfileCardSkeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { getProfileData } from "@/lib/github/profile";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <h1 className="text-title">Profile</h1>
      <div className="mt-6">
        <Suspense
          fallback={
            <SkeletonRegion label="Loading profile">
              <ProfileCardSkeleton />
            </SkeletonRegion>
          }
        >
          <ProfileData />
        </Suspense>
      </div>
    </main>
  );
}

// Fixture dates are relative to now, so this is rendered per request, not at build time.
async function ProfileData() {
  await connection();
  return <ProfileView result={await getProfileData()} />;
}
