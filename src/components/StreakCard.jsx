import { Card, CardContent } from '../components/ui/card';
import { Flame } from 'lucide-react';

export default function StreakCard({ currentStreak, longestStreak }) {
  return (
    <Card
      data-testid="streak-card"
      className="h-full relative overflow-hidden border-slate-200 dark:border-slate-800/80
        bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg"
    >
      <CardContent className="p-6 h-full flex flex-col justify-between">
        
        {/* top */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Current Streak
            </p>

            <div className="mt-2 flex items-baseline gap-2">
              <span
                data-testid="current-streak-value"
                className="text-4xl font-mono font-bold text-slate-900 dark:text-white"
              >
                {currentStreak}
              </span>

              <span className="text-base text-slate-500 dark:text-slate-400">
                days
              </span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <Flame className="w-5 h-5 text-git-green" />
          </div>
        </div>

        {/* bottom */}
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Longest streak:
          <span className="ml-1 font-semibold text-slate-700 dark:text-slate-200">
            {longestStreak} days
          </span>
        </p>

      </CardContent>
    </Card>
  );
}