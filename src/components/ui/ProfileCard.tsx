import { Building, Calendar, ExternalLink, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { formatMonthYear } from "@/lib/format";
import type { Profile } from "@/types/profile";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { CopyUsername } from "./CopyUsername";

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
      <Avatar
        src={profile.avatarUrl}
        name={name}
        className="size-16 sm:size-24"
        initialClassName="text-title"
      />
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-3">
        <div>
          <h2 className="text-title text-text-primary">{name}</h2>
          <CopyUsername login={profile.login} />
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
            Joined {formatMonthYear(profile.createdAt)}
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
