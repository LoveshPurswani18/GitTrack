"use client";

import { Flame, RefreshCw } from "lucide-react";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Heatmap, HeatmapLegend } from "@/components/ui/Heatmap";
import { PRBadge } from "@/components/ui/PRBadge";
import { ProfileCard } from "@/components/ui/ProfileCard";
import { ProjectList, SeriesLegend } from "@/components/ui/ProjectList";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  HeatmapSkeleton,
  SkeletonRegion,
  StatCardSkeleton,
} from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { TimezoneSelect } from "@/components/ui/TimezoneSelect";
import { ThemeSwitchSamples } from "./ThemeSwitchSamples";
import { WorkTag } from "@/components/ui/WorkTag";
import { heatmapGrid } from "@/lib/metrics/heatmap";
import { rangeBounds, type Range } from "@/lib/metrics/range";
import { dayRange, toLocalDay } from "@/lib/metrics/days";
import type { ProjectCount } from "@/lib/metrics/projects";
import type { Profile } from "@/types/profile";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

const SCOPES = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
] as const;

const PROJECTS: ProjectCount[] = [
  { repo: "sample-app", url: "#", isWork: false, count: 196 },
  { repo: "work-repo-a", url: "#", isWork: true, count: 188 },
  { repo: "work-repo-b", url: "#", isWork: true, count: 120 },
  { repo: "side-project", url: "#", isWork: false, count: 104 },
  { repo: "notes-site", url: "#", isWork: false, count: 52 },
  { repo: "dotfiles", url: "#", isWork: false, count: 24 },
  { repo: "scratch-one", url: "#", isWork: false, count: 12 },
  { repo: "scratch-two", url: "#", isWork: false, count: 9 },
  { repo: "scratch-three", url: "#", isWork: false, count: 5 },
  { repo: "a-repo-with-a-very-long-name-that-has-to-truncate-in-the-list", url: "#", isWork: true, count: 2 },
];

const PROFILE: Profile = {
  avatarUrl: "",
  name: "Sample Person",
  login: "sample-person",
  bio: "Builds small tools and writes about them.",
  location: "Jaipur, India",
  company: "Example Co",
  followers: 128,
  following: 64,
  publicRepos: 31,
  createdAt: "2016-10-04T09:00:00Z",
  url: "https://github.com/sample-person",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-heading mb-3">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

// Deterministic pseudo-random daily counts so the heatmap looks the same on every load.
function sampleDaily(days: string[]): Map<string, number> {
  const map = new Map<string, number>();
  days.forEach((day, i) => {
    let h = Math.imul(i + 1, 2654435761);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    const v = ((h ^ (h >>> 13)) >>> 0) / 2 ** 32;
    map.set(day, v < 0.35 ? 0 : Math.ceil(v * v * 14));
  });
  return map;
}

function HeatmapSample({ range, tz, now }: { range: Range; tz: string; now: Date }) {
  const bounds = rangeBounds(range, now, tz);
  const { weeks, total } = useMemo(() => {
    const daily = sampleDaily(dayRange(bounds.start, bounds.end));
    return {
      weeks: heatmapGrid(daily, bounds).weeks,
      total: [...daily.values()].reduce((a, b) => a + b, 0),
    };
  }, [bounds.start, bounds.end]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="rounded-md border border-border bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-heading">Activity</h3>
        <p className="text-caption text-text-muted">
          <span className="text-metric-sm">{total}</span> commits · range {range} · {tz}
        </p>
      </div>
      <Heatmap
        weeks={weeks}
        today={bounds.end}
        ariaLabel={`Commit activity, range ${range}`}
        formatLabel={(cell) => `${cell.count} commits on ${cell.day}`}
      />
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-caption hidden text-text-muted sm:block">
          Levels are quartiles of your active days in this range.
        </p>
        <HeatmapLegend />
      </div>
    </div>
  );
}

export function Showcase({ nowIso }: { nowIso: string }) {
  const [range, setRange] = useState<Range>("6m");
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("all");
  const [tz, setTz] = useState("Asia/Kolkata");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  // The browser's zone only exists on the client; the server snapshot keeps hydration stable.
  const browserZone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );

  return (
    <>
      <Section title="Button">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button icon={RefreshCw}>With icon</Button>
          <Button icon={RefreshCw} iconPosition="trailing">
            Trailing icon
          </Button>
        </Row>
        <Row>
          <Button icon={RefreshCw} busy busyLabel="Refreshing…">
            Refresh
          </Button>
          <Button disabled>Disabled</Button>
          <Button iconOnly icon={RefreshCw} aria-label="Refresh" />
          <Button iconOnly variant="ghost" icon={RefreshCw} aria-label="Refresh (ghost)" />
        </Row>
      </Section>

      <Section title="Theme control options (for review)">
        <ThemeSwitchSamples />
      </Section>

      <Section title="SegmentedControl and TimezoneSelect">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SegmentedControl aria-label="Range" options={RANGES} value={range} onChange={setRange} />
          <SegmentedControl
            aria-label="Repos"
            options={[...SCOPES]}
            value={scope}
            onChange={setScope}
          />
          <div className="flex gap-2 sm:ml-auto">
            <TimezoneSelect value={tz} onChange={setTz} browserZone={browserZone} className="flex-1 sm:flex-none" />
            <Button iconOnly icon={RefreshCw} aria-label="Refresh" />
          </div>
        </div>
        <p className="text-caption text-text-muted">
          Range {range} · repos {scope} · {tz} (browser: {browserZone})
        </p>
      </Section>

      <Section title="StatCard">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
          <StatCard label="Commits today" shortLabel="Today" value={3} context={`so far, ${tz}`} />
          <StatCard
            label="Commits this week"
            shortLabel="This week"
            value={38}
            delta={12}
            deltaLabel="vs last week"
          />
          <StatCard
            label="Current streak"
            shortLabel="Streak"
            icon={Flame}
            iconClassName="text-accent"
            value={14}
            unit="days"
            context={
              <>
                Longest: <span className="text-metric-sm text-text-primary">42</span> days
              </>
            }
          />
          <StatCard label="Total commits" shortLabel="Total" value={684} context="last 6 months" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
          <StatCard label="Commits today" shortLabel="Today" value={0} context="No commits yet today" />
          <StatCard
            label="Commits this week"
            shortLabel="This week"
            value={5}
            delta={-7}
            deltaLabel="vs last week"
          />
          <StatCard
            label="Commits this week"
            shortLabel="This week"
            value={9}
            delta={0}
            deltaLabel="vs last week"
          />
        </div>
      </Section>

      <Section title="Heatmap">
        <HeatmapSample range="1y" tz={tz} now={now} />
        <HeatmapSample range="1w" tz={tz} now={now} />
        <p className="text-caption text-text-muted">Today in {tz}: {toLocalDay(now, tz)}</p>
      </Section>

      <Section title="PRBadge and WorkTag">
        <Row>
          <PRBadge count={3} label="open" status="open" />
          <PRBadge count={11} label="merged" status="merged" />
          <PRBadge count={14} label="opened in range" />
          <PRBadge label="open" status="open" />
          <PRBadge label="merged" status="merged" />
          <PRBadge label="closed" status="closed" />
          <WorkTag />
        </Row>
        <ul className="rounded-md border border-border bg-surface px-4">
          <li className="flex items-center justify-between gap-3 border-b border-border py-3">
            <div className="min-w-0">
              <p className="text-body flex items-center gap-2">
                <span className="truncate">feat: group days in the selected timezone</span>
              </p>
              <p className="text-caption text-text-muted">sample-app · 9 Oct</p>
            </div>
            <PRBadge label="merged" status="merged" />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-body flex items-center gap-2">
                <span className="truncate">Sample work PR title</span>
                <WorkTag />
              </p>
              <p className="text-caption text-text-muted">work-repo-a · 8 Oct</p>
            </div>
            <PRBadge label="closed" status="closed" />
          </li>
        </ul>
      </Section>

      <Section title="ProjectList">
        <div className="rounded-md border border-border bg-surface p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-heading">Commits by project</h3>
            <SeriesLegend />
          </div>
          <ProjectList items={PROJECTS} />
        </div>
      </Section>

      <Section title="Banner">
        <Banner tone="warning" title="GitHub rate limit reached">
          Showing data cached at 14:05. Limit resets at 14:42.
        </Banner>
        <Banner tone="danger" title="GitHub rejected the token">
          Check GITHUB_TOKEN in the environment variables, then refresh.
        </Banner>
      </Section>

      <Section title="Skeleton">
        <SkeletonRegion label="Loading activity">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="mt-4">
            <HeatmapSkeleton />
          </div>
        </SkeletonRegion>
      </Section>

      <Section title="ProfileCard">
        <ProfileCard profile={PROFILE} />
        <ProfileCard
          profile={{ ...PROFILE, name: null, bio: null, location: null, company: null }}
        />
      </Section>
    </>
  );
}
