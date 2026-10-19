// TEMPORARY dev page for cross-checking the live data layer: counts, per-day and per-month
// totals against GitHub's own numbers, and the repo list (names at runtime only). No PR titles
// or commit messages. Returns 404 in production. Kept while the core features are built;
// remove it before launch (docs/TASKS.md, 3.4).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
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
    <main className="mx-auto w-full max-w-[1024px] px-4 pt-6 pb-12 sm:px-6 sm:pt-10">
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

// Every listed repo with its commit count in the window. Names come straight from the data
// ("<owner>/<repo>"), so work repos carry their org prefix; nothing is hard-coded here.
function RepoList({ activity }: { activity: Activity }) {
  const counts = new Map<string, number>();
  for (const commit of activity.commits) counts.set(commit.repo, (counts.get(commit.repo) ?? 0) + 1);
  const count = (name: string) => counts.get(name) ?? 0;
  const repos = [...activity.repos].sort(
    (a, b) => count(b.nameWithOwner) - count(a.nameWithOwner) || a.nameWithOwner.localeCompare(b.nameWithOwner),
  );
  return (
    <details className="mt-4">
      <summary className="text-label cursor-pointer py-2 text-text-secondary">
        Show all {repos.length} listed repos
      </summary>
      <ul>
        {repos.map((repo) => (
          <li key={repo.nameWithOwner} className="flex items-center gap-3 border-b border-border py-2">
            <span className="text-body min-w-0 flex-1 truncate text-text-primary">{repo.nameWithOwner}</span>
            {repo.isWork && (
              <span className="text-tag rounded-sm border border-border px-1.5 text-text-muted">Work</span>
            )}
            <span className="text-caption text-text-muted">{repo.isPrivate ? "Private" : "Public"}</span>
            <span className="w-12 text-right font-mono tabular text-text-primary">{count(repo.nameWithOwner)}</span>
          </li>
        ))}
      </ul>
      <p className="text-caption mt-2 text-text-muted">
        Last column: commits in the window. 0 means listed through a pull request, a fork, or commits outside the window.
      </p>
    </details>
  );
}

async function LiveCheck() {
  await connection(); // request time only
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
  const lastDays = [...dailyCounts(activity.commits, IST, rangeBounds("1m", now, IST))]
    .reverse()
    .map(([day, ist]) => {
      const utc = dailyCounts(activity.commits, "UTC", { start: day, end: day }).get(day) ?? 0;
      const github = githubByDay.get(day) ?? 0;
      return { day, ist, utc, github };
    });
  const lastTotals = lastDays.reduce(
    (t, d) => ({ ist: t.ist + d.ist, utc: t.utc + d.utc, github: t.github + d.github }),
    { ist: 0, utc: 0, github: 0 },
  );

  // Commits per month (IST), against GitHub's own count, for the profile's "Created N commits" lines.
  const monthly = new Map<string, { ours: number; github: number }>();
  const addMonth = (month: string, key: "ours" | "github", n: number) => {
    const entry = monthly.get(month) ?? { ours: 0, github: 0 };
    entry[key] += n;
    monthly.set(month, entry);
  };
  for (const [day, n] of dailyCounts(activity.commits, IST, rangeBounds("1y", now, IST))) addMonth(day.slice(0, 7), "ours", n);
  for (const [day, n] of githubByDay) addMonth(day.slice(0, 7), "github", n);
  const months = [...monthly].sort(([a], [b]) => b.localeCompare(a));

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

      <Section title="Commits in the window" heads={["Count"]}>
        <Row label="All fetched (REST, author date)" values={[activity.commits.length]} />
        <Row label="Dropped: repo not listed (should be 0)" values={[activity.commits.length - all.commits.length]} />
        <Row label="Work" values={[work.commits.length]} />
        <Row label="Personal" values={[personal.commits.length]} />
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

      <Section title="Last 30 days (commits per day)" heads={["IST", "UTC", "GitHub", "IST − GitHub"]}>
        {lastDays.map(({ day, ist, utc, github }) => (
          <Row key={day} label={day} values={[ist, utc, github, signed(ist - github)]} />
        ))}
        <Row
          label="30-day total"
          values={[lastTotals.ist, lastTotals.utc, lastTotals.github, signed(lastTotals.ist - lastTotals.github)]}
        />
      </Section>
      <p className="text-caption mt-2 text-text-muted">
        IST and UTC are our REST counts by author date. GitHub is its own per-day commit count (GraphQL) by the date it
        reports, limited to the first 100 active days per repo, so a very busy repo can miss its latest days. The
        profile heatmap also counts PRs, reviews and issues, so it is not comparable to this table.
      </p>

      <Section title="By month (commits per month)" heads={["Ours (IST)", "GitHub", "Ours − GitHub"]}>
        {months.map(([month, { ours, github }]) => (
          <Row key={month} label={month} values={[ours, github, signed(ours - github)]} />
        ))}
      </Section>
      <p className="text-caption mt-2 text-text-muted">
        Compare GitHub with the profile&apos;s &quot;Created N commits in M repositories&quot; line for each month. The
        oldest month is partial, because the window starts mid-month.
      </p>
    </>
  );
}
