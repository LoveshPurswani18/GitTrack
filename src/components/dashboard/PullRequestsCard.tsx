import { PRBadge } from "@/components/ui/PRBadge";
import { WorkTag } from "@/components/ui/WorkTag";
import { formatDayMonth, repoName } from "@/lib/format";
import { toLocalDay } from "@/lib/metrics/days";
import type { PrStats } from "@/lib/metrics/prs";
import type { PullRequest, Repo } from "@/types/activity";

export function PullRequestsCard({
  stats,
  recent,
  repos,
  tz,
}: {
  stats: PrStats;
  recent: PullRequest[];
  repos: Repo[];
  tz: string;
}) {
  const workRepos = new Set(repos.filter((r) => r.isWork).map((r) => r.nameWithOwner));
  return (
    <section
      aria-label="Pull requests"
      className="min-w-0 flex-[1_1_380px] rounded-md border border-border bg-surface p-4 sm:p-6"
    >
      <h2 className="text-heading mb-4 text-text-primary">Pull requests</h2>
      <div className="flex flex-wrap gap-2">
        <PRBadge count={stats.openNow} label="open" status="open" />
        <PRBadge count={stats.merged} label="merged" status="merged" />
        <PRBadge
          count={stats.opened}
          label={
            <>
              <span className="sm:hidden">opened</span>
              <span className="hidden sm:inline">opened in range</span>
            </>
          }
        />
      </div>
      {recent.length === 0 ? (
        <p className="mt-4 border-t border-border py-8 text-center text-text-secondary">
          No pull requests in this range
        </p>
      ) : (
        <ul className="mt-4 border-t border-border">
          {recent.map((pr) => (
            <li
              key={`${pr.repo}#${pr.number}`}
              className="flex items-center justify-between gap-3 border-b border-border py-3"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body truncate text-text-primary hover:text-text-secondary"
                  >
                    {pr.title}
                  </a>
                  {workRepos.has(pr.repo) && <WorkTag />}
                </div>
                <p className="text-caption truncate text-text-muted">
                  {repoName(pr.repo)} · {formatDayMonth(toLocalDay(pr.createdAt, tz))}
                </p>
              </div>
              <PRBadge label={pr.state} status={pr.state} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
