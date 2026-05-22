/**
 * Dashboard.jsx — GitTrack core page (Phase 1 rewrite)
 *
 * Changes vs original:
 *  - Uses fetchUserEvents (paginated) from the rewritten github.js
 *  - Passes raw events to processGithubData from the rewritten githubStats.js
 *  - Three explicit fetch states: idle → loading → success | error
 *  - Rate-limit errors show the reset time instead of silently falling back
 *    to mock data (so you know something went wrong)
 *  - Mock data fallback is still available but is opt-in (FORCE_MOCK=true)
 *    so you don't accidentally debug against fake numbers
 */

import { useEffect, useState } from 'react';
import { fetchUserEvents } from '../utils/github';
import { processGithubData } from '../utils/githubStats';
import { mockData } from '../utils/mockData';

import Header from '../components/Header';
import Footer from '../components/Footer';
import StreakCard from '../components/StreakCard';
import TodayCard from '../components/TodayCard';
import WeeklyCard from '../components/WeeklyCard';
import Heatmap from '../components/Heatmap';
import ConsistencyCircle from '../components/ConsistencyCircle';
import StatCard from '../components/StatCard';

import {
  FileText,
  CalendarCheck,
  CalendarX,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const USERNAME = 'LoveshPurswani18';
const DAILY_GOAL = 1; // commits per day

// Set true only when you intentionally want to develop against mock data
const FORCE_MOCK = false;

// ---------------------------------------------------------------------------
// Fetch status constants
// ---------------------------------------------------------------------------
const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (FORCE_MOCK) {
      setStats(processGithubData(mockData.events ?? []));
      setStatus(STATUS.SUCCESS);
      return;
    }

    async function load() {
      setStatus(STATUS.LOADING);
      setError(null);

      try {
        const events = await fetchUserEvents(USERNAME);
        const processed = processGithubData(events);
        setStats(processed);
        setStatus(STATUS.SUCCESS);
      } catch (err) {
        console.error('[GitTrack] Fetch failed:', err);
        setError(err);
        setStatus(STATUS.ERROR);

        // Fallback: show mock data so the UI isn't completely blank,
        // but keep the error banner so you know it's not real data.
        setStats(processGithubData(mockData.events ?? []));
      }
    }

    load();
  }, []);

  // Destructure with safe defaults so components never receive undefined
  const {
    currentStreak = 0,
    longestStreak = 0,
    todayCommits = 0,
    weekData = [],
    activeDaysThisWeek = 0,
    weeklyConsistency = 0,
    heatmapData = [],
    totalCommits = 0,
    activeDays = 0,
    missedDays = 0,
    avgCommitsPerDay = 0,
    consistency = 0,
  } = stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A]">
      <Header username={USERNAME} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Page title */}
        <div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-slate-900 dark:text-white">
            Developer Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest">
            {status === STATUS.LOADING && 'Fetching live data…'}
            {status === STATUS.SUCCESS && `Last updated: just now`}
            {status === STATUS.ERROR && 'Showing cached data — see error below'}
          </p>
        </div>

        {/* Error banner — visible only on fetch failure */}
        {status === STATUS.ERROR && error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span className="font-semibold">Data fetch failed: </span>
            {error.message}
            {error.code === 'RATE_LIMIT' && (
              <span className="ml-1 opacity-70">(Stats below are mock data.)</span>
            )}
          </div>
        )}

        {/* Top row: streak · today · weekly */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StreakCard
            currentStreak={currentStreak}
            longestStreak={longestStreak}
          />
          <TodayCard
            todayCommits={todayCommits}
            dailyGoal={DAILY_GOAL}
          />
          <WeeklyCard
            weeklyData={weekData}
            weeklyActiveDays={activeDaysThisWeek}
            weeklyConsistencyPercent={weeklyConsistency}
          />
        </div>

        {/* Heatmap */}
        <Heatmap
          dailyData={heatmapData}
        />

        {/* Bottom row: consistency circle + stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ConsistencyCircle
            percent={consistency}
          />

          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            <StatCard
              label="Total commits (30 days)"
              value={totalCommits}
              icon={FileText}
            />
            <StatCard
              label="Active days"
              value={activeDays}
              subtitle={`Target: 28 days`}
              icon={CalendarCheck}
            />
            <StatCard
              label="Missed days"
              value={missedDays}
              icon={CalendarX}
              variant={missedDays > 10 ? 'warning' : 'default'}
            />
            <StatCard
              label="Avg commits / day"
              value={avgCommitsPerDay}
              subtitle="Commits per day"
              icon={Zap}
            />
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}