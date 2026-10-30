// Dev-only page for cross-checking the live data layer: counts, per-day and per-month totals
// against GitHub's own numbers, and the repo list (names at runtime only). No PR titles or
// commit messages. Returns 404 in production. Kept on purpose for live accuracy checks such as
// the 30 random IST days (docs/TASKS.md, 3.6).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import type { Activity } from "@/types/activity";
import { getActivity } from "@/lib/github";
import {
  commitsToday,
  currentStreak,
  dailyCounts,
  filterByScope,
  longestStreak,
  prStats,
  rangeBounds,
  thisWeekVsLast,
  totalInRange,
} from "@/lib/metrics";

export const metadata: Metadata = { title: "Live check" };

const ZONES = ["Asia/Kolkata", "UTC"] as const;

export default function LiveCheckPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
      <h1 className="text-title">Live check</h1>
      <p className="text-body text-text-secondary">
        Temporary page for comparing the data layer with your GitHub profile.
      </p>
      <Suspense fallback={<p className="text-body text-text-muted">Loading…</p>}>
        <LiveCheck />
      </Suspense>
    </main>
  );
}

function Row({ label, values }: { label: string; values: (string | number)[] }) {
  return (
    <tr className="border-b border-border">
      <th scope="row" className="text-body py-2 pr-4 text-left font-normal text-text-secondary">
        {label}
      </th>
      {values.map((value, i) => (
        <td key={i} className="py-2 pr-4 text-right font-mono tabular text-text-primary">
          {value}
        </td>
      ))}
    </tr>
  );
}

function Section({ title, heads, children }: { title: string; heads: string[]; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-heading">{title}</h2>
      <table className="mt-2 w-full">
        <thead>
          <tr className="border-b border-border">
            <th />
            {heads.map((head) => (
              <th key={head} className="text-label py-2 pr-4 text-right text-text-muted">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

// The commits GitHub itself would count: those on the default branch, plus the squash and rebase
// copies we dropped because the pull request's own commits replace them.
function defaultBranchCommits(activity: Activity) {
  return [...activity.commits.filter((c) => c.onDefault), ...activity.supersededCommits];
}

// Every listed repo with its commit count in the window, on all branches and on the default
// branch only. Names come straight from the data ("<owner>/<repo>"), so work repos carry their
// org prefix; nothing is hard-coded here.
function RepoList({ activity }: { activity: Activity }) {
  const all = new Map<string, number>();
  const onDefault = new Map<string, number>();
  const bump = (map: Map<string, number>, repo: string) => map.set(repo, (map.get(repo) ?? 0) + 1);
  for (const commit of activity.commits) bump(all, commit.repo);
  for (const commit of defaultBranchCommits(activity)) bump(onDefault, commit.repo);
  const count = (map: Map<string, number>, name: string) => map.get(name) ?? 0;
  const repos = [...activity.repos].sort(
    (a, b) =>
      count(all, b.nameWithOwner) - count(all, a.nameWithOwner) ||
      a.nameWithOwner.localeCompare(b.nameWithOwner),
  );
  return (
    <details className="mt-4">
      <summary className="text-label cursor-pointer py-2 text-text-secondary">
        Show all {repos.length} listed repos
      </summary>
      <ul>
        <li className="text-caption flex items-center gap-3 border-b border-border py-2 text-text-muted">
          <span className="min-w-0 flex-1">Repo</span>
          <span className="w-20 text-right">Default branch</span>
          <span className="w-20 text-right">All branches</span>
        </li>
        {repos.map((repo) => (
          <li key={repo.nameWithOwner} className="flex items-center gap-3 border-b border-border py-2">
            <span className="text-body min-w-0 flex-1 truncate text-text-primary">{repo.nameWithOwner}</span>
            {repo.isWork && (
              <span className="text-tag rounded-sm border border-border px-1.5 text-text-muted">Work</span>
            )}
            <span className="text-caption text-text-muted">{repo.isPrivate ? "Private" : "Public"}</span>
            <span className="w-20 text-right font-mono tabular text-text-primary">
              {count(onDefault, repo.nameWithOwner)}
            </span>
            <span className="w-20 text-right font-mono tabular text-text-primary">
              {count(all, repo.nameWithOwner)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption mt-2 text-text-muted">
        Default branch: the commits GitHub itself would count (including squash and rebase copies
        replaced by the pull request&apos;s own commits). All branches: what the dashboard counts. 0 in both
        means the repo is listed through a pull request, a fork, or commits outside the window.
      </p>
    </details>
  );
}

async function LiveCheck() {
  await connection(); // request time only
  await requireSession(); // every data read checks the pass itself
  const config = getConfig();
  const activity = await getActivity();
  const now = new Date(activity.fetchedAt);

  const all = filterByScope(activity, "all");
  const work = filterByScope(activity, "work");
  const personal = filterByScope(activity, "personal");
  const crossCheckTotal = activity.crossCheck.reduce((sum, day) => sum + day.count, 0);

  // GitHub's own per-day commit counts (GraphQL), keyed by the date exactly as GitHub reports it.
  const githubByDay = new Map(activity.crossCheck.map((d) => [d.date, d.count]));
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  const IST = "Asia/Kolkata";
  // What GitHub itself counts: the default-branch part of our commits. The all-branch column is
  // what the dashboard shows; only the default-branch column is comparable with GitHub's numbers.
  const onDefault = defaultBranchCommits(activity);
  const lastDays = [...dailyCounts(activity.commits, IST, rangeBounds("1m", now, IST))]
    .reverse()
    .map(([day, ist]) => {
      const istDefault = dailyCounts(onDefault, IST, { start: day, end: day }).get(day) ?? 0;
      const utc = dailyCounts(activity.commits, "UTC", { start: day, end: day }).get(day) ?? 0;
      const github = githubByDay.get(day) ?? 0;
      return { day, ist, istDefault, utc, github };
    });
  const lastTotals = lastDays.reduce(
    (t, d) => ({
      ist: t.ist + d.ist,
      istDefault: t.istDefault + d.istDefault,
      utc: t.utc + d.utc,
      github: t.github + d.github,
    }),
    { ist: 0, istDefault: 0, utc: 0, github: 0 },
  );

  // Commits per month (IST), against GitHub's own count, for the profile's "Created N commits" lines.
  const monthly = new Map<string, { all: number; ours: number; github: number }>();
  const addMonth = (month: string, key: "all" | "ours" | "github", n: number) => {
    const entry = monthly.get(month) ?? { all: 0, ours: 0, github: 0 };
    entry[key] += n;
    monthly.set(month, entry);
  };
  const yearBounds = rangeBounds("1y", now, IST);
  for (const [day, n] of dailyCounts(activity.commits, IST, yearBounds)) addMonth(day.slice(0, 7), "all", n);
  for (const [day, n] of dailyCounts(onDefault, IST, yearBounds)) addMonth(day.slice(0, 7), "ours", n);
  for (const [day, n] of githubByDay) addMonth(day.slice(0, 7), "github", n);
  const months = [...monthly].sort(([a], [b]) => b.localeCompare(a));

  // Today in IST: the numbers that should move as soon as new work lands (after the 15 minute cache).
  const today = rangeBounds("today", now, IST);
  const scopes = [
    ["All", all],
    ["Work", work],
    ["Personal", personal],
  ] as const;

  return (
    <>
      <Section title="Run" heads={[""]}>
        <Row label="Data source" values={[config.dataSource]} />
        <Row label="Fetched at (UTC)" values={[activity.fetchedAt]} />
        <Row label="Window start (UTC)" values={[activity.windowStart]} />
        <Row label="Repos listed (work)" values={[`${activity.repos.length} (${activity.repos.filter((r) => r.isWork).length})`]} />
        <Row label="Restricted contributions" values={[activity.restrictedCount]} />
      </Section>
      <RepoList activity={activity} />

      <Section title="Today (IST)" heads={["All", "Work", "Personal"]}>
        <Row
          label="Commits today, all branches (the dashboard)"
          values={scopes.map(([, s]) => totalInRange(s.commits, IST, today))}
        />
        <Row
          label="Commits today, default branch only"
          // Same list as the other "default branch" columns (onDefault plus superseded copies),
          // narrowed to the scope's repos because filterByScope leaves supersededCommits alone.
          values={scopes.map(([, s]) => {
            const inScope = new Set(s.repos.map((r) => r.nameWithOwner));
            return totalInRange(
              onDefault.filter((c) => inScope.has(c.repo)),
              IST,
              today,
            );
          })}
        />
        <Row
          label="Pull requests opened today"
          values={scopes.map(([, s]) => prStats(s.pullRequests, IST, today).opened)}
        />
        <Row
          label="Pull requests merged today"
          values={scopes.map(([, s]) => prStats(s.pullRequests, IST, today).merged)}
        />
      </Section>
      <p className="text-caption mt-2 text-text-muted">
        The data is cached for 15 minutes, and Refresh does nothing yet, so very new work can take a few
        minutes to appear. Commits on a branch with no pull request yet are counted too.
      </p>

      <Section title="Commits in the window" heads={["Count"]}>
        <Row label="All branches (ours, by author date)" values={[activity.commits.length]} />
        <Row label="…of which on the default branch" values={[activity.commits.filter((c) => c.onDefault).length]} />
        <Row label="…of which only on other branches" values={[activity.commits.filter((c) => !c.onDefault).length]} />
        <Row label="Superseded (squash and rebase copies dropped)" values={[activity.supersededCommits.length]} />
        <Row label="Default branch + superseded (comparable with GitHub)" values={[onDefault.length]} />
        <Row label="Dropped: repo not listed (should be 0)" values={[activity.commits.length - all.commits.length]} />
        <Row label="Work (all branches)" values={[work.commits.length]} />
        <Row label="Personal (all branches)" values={[personal.commits.length]} />
        <Row label="GitHub's own count (GraphQL, first 100 days per repo)" values={[crossCheckTotal]} />
      </Section>

      <Section title="By timezone" heads={[...ZONES]}>
        <Row label="Total, 1Y range" values={ZONES.map((tz) => totalInRange(activity.commits, tz, rangeBounds("1y", now, tz)))} />
        <Row label="Commits today" values={ZONES.map((tz) => commitsToday(activity.commits, tz, now))} />
        <Row
          label="This week / last week (same days)"
          values={ZONES.map((tz) => {
            const w = thisWeekVsLast(activity.commits, tz, now);
            return `${w.thisWeek} / ${w.lastWeek}`;
          })}
        />
        <Row label="Current streak" values={ZONES.map((tz) => currentStreak(activity.commits, tz, now))} />
        <Row label="Longest streak" values={ZONES.map((tz) => longestStreak(activity.commits, tz))} />
      </Section>

      <Section title="Pull requests, 1Y range (IST)" heads={["All", "Work", "Personal"]}>
        {(["opened", "merged", "openNow"] as const).map((key) => (
          <Row
            key={key}
            label={{ opened: "Opened", merged: "Merged", openNow: "Open now" }[key]}
            values={[all, work, personal].map(
              (scope) => prStats(scope.pullRequests, "Asia/Kolkata", rangeBounds("1y", now, "Asia/Kolkata"))[key],
            )}
          />
        ))}
      </Section>

      <Section
        title="Last 30 days (commits per day)"
        heads={["IST all branches", "IST default only", "UTC all branches", "GitHub", "Default only − GitHub"]}
      >
        {lastDays.map(({ day, ist, istDefault, utc, github }) => (
          <Row key={day} label={day} values={[ist, istDefault, utc, github, signed(istDefault - github)]} />
        ))}
        <Row
          label="30-day total"
          values={[
            lastTotals.ist,
            lastTotals.istDefault,
            lastTotals.utc,
            lastTotals.github,
            signed(lastTotals.istDefault - lastTotals.github),
          ]}
        />
      </Section>
      <p className="text-caption mt-2 text-text-muted">
        All branches is what the dashboard counts. Default only is the part GitHub itself counts (including squash
        and rebase copies replaced by a pull request&apos;s own commits), so the last column should be near 0, as in
        the spike. GitHub is its own per-day commit count (GraphQL) by the date it reports, limited to the first 100
        active days per repo, so a very busy repo can miss its latest days. The profile heatmap also counts PRs,
        reviews and issues, so it is not comparable to this table.
      </p>

      <Section
        title="By month (commits per month)"
        heads={["Ours, all branches (IST)", "Ours, default only (IST)", "GitHub", "Default only − GitHub"]}
      >
        {months.map(([month, { all: allBranches, ours, github }]) => (
          <Row key={month} label={month} values={[allBranches, ours, github, signed(ours - github)]} />
        ))}
      </Section>
      <p className="text-caption mt-2 text-text-muted">
        Compare GitHub with the profile&apos;s &quot;Created N commits in M repositories&quot; line for each month,
        using the default-only column. The oldest month is partial, because the window starts mid-month.
      </p>
    </>
  );
}
