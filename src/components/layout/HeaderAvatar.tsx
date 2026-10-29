import { connection } from "next/server";
import { Avatar } from "@/components/ui/Avatar";
import { getProfileData } from "@/lib/github/profile";

/** The neutral circle: shown while the profile loads, and when it cannot be fetched. */
export function AvatarPlaceholder() {
  return <span aria-hidden="true" className="block size-7 rounded-full border border-border bg-surface-hover" />;
}

/** The profile's avatar (or initial) for the header. A failed fetch just leaves the neutral circle. */
export async function HeaderAvatar() {
  await connection();
  const result = await getProfileData();
  if (result.status === "error") return <AvatarPlaceholder />;
  const { profile } = result;
  return (
    <Avatar
      src={profile.avatarUrl}
      name={profile.name || profile.login}
      className="size-7"
      initialClassName="text-label font-semibold"
    />
  );
}
