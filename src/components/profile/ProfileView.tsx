"use client";

import { StateBanner } from "@/components/dashboard/States";
import { useTimeAgo } from "@/components/dashboard/UpdatedAgo";
import { useClientEnvironment } from "@/components/dashboard/useClientEnvironment";
import { ProfileCard } from "@/components/ui/ProfileCard";
import type { ProfileResult } from "@/types/profile";

/** The card and its caption, or a banner and no card when the profile could not be fetched. */
export function ProfileView({ result }: { result: ProfileResult }) {
  if (result.status === "error") return <ProfileError error={result.error} />;
  return (
    <div className="flex flex-col gap-6">
      <ProfileCard profile={result.profile} />
      <Caption fetchedAt={result.profile.fetchedAt} />
    </div>
  );
}

function Caption({ fetchedAt }: { fetchedAt: string }) {
  const ago = useTimeAgo(fetchedAt);
  return (
    <p className="text-caption text-text-muted">
      Public profile data from GitHub{ago ? ` · Updated ${ago}` : ""}
    </p>
  );
}

function ProfileError({ error }: { error: Extract<ProfileResult, { status: "error" }>["error"] }) {
  const env = useClientEnvironment();
  // The reset time needs the browser's timezone, which is unknown on the server.
  if (!env) return null;
  return <StateBanner error={error} tz={env.browserZone} />;
}
