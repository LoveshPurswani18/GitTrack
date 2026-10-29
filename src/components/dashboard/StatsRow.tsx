import { Flame } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";

export type Stats = {
  today: number;
  thisWeek: number;
  /** This week minus the same span last week. */
  delta: number;
  streak: number;
  longest: number;
  total: number;
};

// The mobile cards use shorter lines than desktop (DESIGN.md §6.4 and the mobile screens).
const Figure = ({ children }: { children: number }) => (
  <span className="text-metric-sm text-text-primary">{children}</span>
);

export function StatsRow({
  stats,
  rangeLabel,
  tz,
  cachedAt,
}: {
  stats: Stats;
  rangeLabel: string;
  tz: string;
  /** "14:05" when old data is shown after a failed refresh; replaces the live context lines. */
  cachedAt?: string;
}) {
  const cachedLine = cachedAt ? `cached at ${cachedAt}` : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
      <StatCard
        label="Commits today"
        shortLabel="Today"
        value={stats.today}
        context={
          cachedLine ??
          (stats.today === 0 ? (
            "No commits yet today"
          ) : (
            <>
              <span className="sm:hidden">commits so far</span>
              <span className="hidden sm:inline">so far, {tz}</span>
            </>
          ))
        }
      />
      <StatCard
        label="Commits this week"
        shortLabel="This week"
        value={stats.thisWeek}
        delta={cachedLine || stats.delta === 0 ? undefined : stats.delta}
        deltaLabel={
          <>
            <span className="sm:hidden">vs last</span>
            <span className="hidden sm:inline">vs last week</span>
          </>
        }
        context={
          cachedLine ??
          (stats.delta === 0 ? (
            <>
              <span className="sm:hidden">Same as last</span>
              <span className="hidden sm:inline">Same as last week</span>
            </>
          ) : undefined)
        }
      />
      <StatCard
        label="Current streak"
        shortLabel="Streak"
        icon={Flame}
        iconClassName="text-accent"
        value={stats.streak}
        unit={stats.streak === 1 ? "day" : "days"}
        context={
          <>
            <span className="sm:hidden">
              Longest <Figure>{stats.longest}</Figure>
            </span>
            <span className="hidden sm:inline">
              Longest: <Figure>{stats.longest}</Figure> {stats.longest === 1 ? "day" : "days"}
            </span>
          </>
        }
      />
      <StatCard label="Total commits" shortLabel="Total" value={stats.total} context={rangeLabel} />
    </div>
  );
}
