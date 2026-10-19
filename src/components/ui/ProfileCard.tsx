import { Building, Calendar, ExternalLink, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import type { Profile } from "@/types/profile";
import { Button } from "./Button";

function joined(createdAt: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(createdAt),
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-label font-normal text-text-secondary">
      <span className="text-text-muted">{icon}</span>
      {children}
    </span>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-caption text-text-muted">{label}</span>
      <span className="text-metric text-text-primary">{value}</span>
    </div>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  const name = profile.name || profile.login;
  return (
    <div className="flex flex-wrap gap-8 rounded-md border border-border bg-surface p-8">
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          className="h-16 w-16 rounded-full border border-border sm:h-24 sm:w-24"
        />
      ) : (
        <span
          aria-hidden="true"
          className="text-title flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-hover text-text-secondary sm:h-24 sm:w-24"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-3">
        <div>
          <h2 className="text-title text-text-primary">{name}</h2>
          <p className="font-mono text-[14px] leading-5 text-text-muted">@{profile.login}</p>
        </div>
        {profile.bio && <p className="text-body text-text-secondary">{profile.bio}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {profile.location && (
            <Meta icon={<MapPin size={16} strokeWidth={1.5} aria-hidden="true" />}>{profile.location}</Meta>
          )}
          {profile.company && (
            <Meta icon={<Building size={16} strokeWidth={1.5} aria-hidden="true" />}>{profile.company}</Meta>
          )}
          <Meta icon={<Calendar size={16} strokeWidth={1.5} aria-hidden="true" />}>
            Joined {joined(profile.createdAt)}
          </Meta>
        </div>
        <div className="flex flex-wrap gap-8">
          <Count label="Followers" value={profile.followers} />
          <Count label="Following" value={profile.following} />
          <Count label="Public repos" value={profile.publicRepos} />
        </div>
        <div>
          <Button
            variant="primary"
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            icon={ExternalLink}
            iconPosition="trailing"
          >
            View on GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}
