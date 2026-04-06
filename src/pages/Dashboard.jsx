// export default function Dashboard() {
//   return (
//     <div className="min-h-screen bg-black text-white p-10">
//       Dashboard working
//     </div>
//   );
// }

import Header from '../components/Header';
import StreakCard from '../components/StreakCard';
import TodayCard from '../components/TodayCard';
import WeeklyCard from '../components/WeeklyCard';
import Heatmap from '../components/Heatmap';
import ConsistencyCircle from '../components/ConsistencyCircle';
import StatCard from '../components/StatCard';
import Footer from '../components/Footer';
import { Card } from '../components/ui/card';

import { mockData } from '../utils/mockData';
import { FileText, CalendarCheck, CalendarX, Zap } from 'lucide-react';


export default function Dashboard() {
  const data = mockData;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A]">
      <Header username={data.username} avatarUrl={data.avatarUrl} />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* Title section */}
        <div
          data-testid="dashboard-title-section"
          className="animate-fade-in"
          style={{ animationDelay: '0s' }}
        >
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

        {/* Top Row: 3 cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-fade-in"
          style={{ animationDelay: '0.1s' }}
        >
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
        <div
          className="animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          <Heatmap dailyData={data.dailyData} />
        </div>

        {/* Bottom section: Consistency circle + Stats grid */}
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 animate-fade-in"
          style={{ animationDelay: '0.3s' }}
        >
          {/* Consistency Circle - spans 1 col */}
          <Card className="border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">
            <ConsistencyCircle percent={data.consistencyPercent} />
          </Card>

          {/* Stats grid - spans 2 cols */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <StatCard
              icon={FileText}
              label="Total Commits (30 Days)"
              value={data.totalCommits}
              subtitle={data.comparisonCommits}
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
              subtitle={data.comparisonMissed}
              variant="warning"
            />
            <StatCard
              icon={Zap}
              label="Daily Average"
              value={data.avgCommitsPerDay}
              subtitle="Commits per session"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}