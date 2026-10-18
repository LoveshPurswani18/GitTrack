import type { Activity } from "@/types/activity";

export type Scope = "all" | "personal" | "work";

/**
 * Keeps the repos, commits and pull requests that match the scope. Records whose repo
 * is not in `activity.repos` are dropped in every scope: they can't be classed as
 * personal or work, and guessing could leak work data into Personal.
 */
export function filterByScope(activity: Activity, scope: Scope): Activity {
  const isWorkByRepo = new Map(activity.repos.map((r) => [r.nameWithOwner, r.isWork]));
  const keep = (repo: string) => {
    const isWork = isWorkByRepo.get(repo);
    if (isWork === undefined) return false;
    return scope === "all" || (scope === "work") === isWork;
  };
  return {
    ...activity,
    repos: activity.repos.filter((r) => keep(r.nameWithOwner)),
    commits: activity.commits.filter((c) => keep(c.repo)),
    pullRequests: activity.pullRequests.filter((p) => keep(p.repo)),
  };
}
