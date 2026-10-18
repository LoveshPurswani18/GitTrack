import type { Activity } from "@/types/activity";
import { toLocalDay } from "./days";
import { type DayBounds, inBounds } from "./range";

export type ProjectCount = { repo: string; url: string; isWork: boolean; count: number };

/**
 * Commits per repo in range, busiest first (ties by name). Commits whose repo is not in
 * `activity.repos` are skipped, matching filterByScope.
 */
export function commitsByRepo(
  activity: Activity,
  timeZone: string,
  bounds: DayBounds,
): ProjectCount[] {
  const known = new Map(activity.repos.map((r) => [r.nameWithOwner, r]));
  const counts = new Map<string, number>();
  for (const commit of activity.commits) {
    if (!known.has(commit.repo)) continue;
    if (!inBounds(toLocalDay(commit.authoredAt, timeZone), bounds)) continue;
    counts.set(commit.repo, (counts.get(commit.repo) ?? 0) + 1);
  }
  return [...counts]
    .map(([repo, count]) => {
      const { url, isWork } = known.get(repo)!;
      return { repo, url, isWork, count };
    })
    .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo));
}
