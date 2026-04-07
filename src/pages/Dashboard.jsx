import { useState, useEffect } from "react";
import Header from "../components/Header";
import StreakCard from "../components/StreakCard";
import TodayCard from "../components/TodayCard";
import WeeklyCard from "../components/WeeklyCard";
import Heatmap from "../components/Heatmap";
import ConsistencyCircle from "../components/ConsistencyCircle";
import StatCard from "../components/StatCard";
import Footer from "../components/Footer";
import { Card } from "../components/ui/card";

import { fetchGithubEvents } from "../utils/github";
import {
  groupCommitsByDay,
  build30DayData,
  calculateStreak
} from "../utils/githubStats";

import { mockData } from "../utils/mockData";

import { FileText, CalendarCheck, CalendarX, Zap } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState(mockData);

  useEffect(() => {
    async function load() {
      try {
        const events = await fetchGithubEvents();

        const commitMap = await groupCommitsByDay(events)

        const dailyData = build30DayData(commitMap);

        const currentStreak = calculateStreak(commitMap);

        // today commits
        const todayKey = new Date().toISOString().split("T")[0];
        const todayCommits = commitMap[todayKey] || 0;

        // total commits
        const totalCommits = dailyData.reduce(
          (sum, d) => sum + d.commits,
          0
        );

        // active days
        const activeDays = dailyData.filter(
          d => d.commits > 0
        ).length;

        // missed days
        const missedDays = 30 - activeDays;

        // consistency %
        const consistencyPercent = Math.round(
          (activeDays / 30) * 100
        );

        // avg commits/day
        const avgCommitsPerDay =
          activeDays === 0
            ? 0
            : (totalCommits / activeDays).toFixed(1);

        // weekly data (last 7 days)
        const weeklyData = dailyData.slice(-7);

        const weeklyActiveDays = weeklyData.filter(
          d => d.commits > 0
        ).length;

        const weeklyConsistencyPercent = Math.round(
          (weeklyActiveDays / 7) * 100
        );

        setData(prev => ({
          ...prev,
          dailyData,
          currentStreak,
          todayCommits,
          totalCommits,
          activeDays,
          missedDays,
          consistencyPercent,
          avgCommitsPerDay,
          weeklyData,
          weeklyActiveDays,
          weeklyConsistencyPercent
        }));

      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A]">
      <Header username={data.login} avatarUrl={data.avatarUrl} />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8">
        
        {/* Title */}
        <div className="animate-fade-in">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono font-bold tracking-tight text-slate-900 dark:text-white">
            Developer Dashboard
          </h1>

          <div className="mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-git-green animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Last updated: {data.lastUpdated}
            </p>
          </div>
        </div>

        {/* Top row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <StreakCard
            currentStreak={data.currentStreak}
            longestStreak={data.longestStreak}
          />

          <TodayCard
            todayCommits={data.todayCommits}
            dailyGoal={data.dailyGoal}
          />

          <WeeklyCard
            weeklyData={data.weeklyData}
            weeklyActiveDays={data.weeklyActiveDays}
            weeklyConsistencyPercent={data.weeklyConsistencyPercent}
          />
        </div>

        {/* Heatmap */}
        <Heatmap dailyData={data.dailyData} />

        {/* Bottom */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          <Card className="h-full border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">
            <ConsistencyCircle percent={data.consistencyPercent} />
          </Card>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            <StatCard
              icon={FileText}
              label="Total Commits (30 Days)"
              value={data.totalCommits}
            />

            <StatCard
              icon={CalendarCheck}
              label="Active Days"
              value={data.activeDays}
              subtitle={`Target: ${data.activeDaysTarget} days`}
            />

            <StatCard
              icon={CalendarX}
              label="Missed Days"
              value={data.missedDays}
              variant="warning"
            />

            <StatCard
              icon={Zap}
              label="Avg Commits/Day"
              value={data.avgCommitsPerDay}
              subtitle="Commits per day"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}