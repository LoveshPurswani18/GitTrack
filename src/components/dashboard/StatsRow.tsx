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
}: {
  stats: Stats;
  rangeLabel: string;
  tz: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
      <StatCard
        label="Commits today"
        shortLabel="Today"
        value={stats.today}
        context={
          stats.today === 0 ? (
            "No commits yet today"
          ) : (
            <>
              <span className="sm:hidden">commits so far</span>
              <span className="hidden sm:inline">so far, {tz}</span>
            </>
          )
        }
      />
      <StatCard
        label="Commits this week"
        shortLabel="This week"
        value={stats.thisWeek}
        delta={stats.delta}
        deltaLabel={
          <>
            <span className="sm:hidden">vs last</span>
            <span className="hidden sm:inline">vs last week</span>
          </>
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
