import { Card, CardContent } from '../components/ui/card';

export default function WeeklyCard({ weeklyData, weeklyActiveDays, weeklyConsistencyPercent }) {
  return (
    <Card
      data-testid="weekly-card"
      className="relative overflow-hidden border-slate-200 dark:border-slate-800/80
        bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg"
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Weekly Consistency
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
              {weeklyActiveDays} / 7 days coded
            </p>
          </div>
          <span
            data-testid="weekly-percent"
            className="text-xl font-mono font-bold text-git-green"
          >
            {weeklyConsistencyPercent}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-git-green transition-all duration-700"
            style={{ width: `${weeklyConsistencyPercent}%` }}
          />
        </div>

        {/* Day indicators */}
        <div className="mt-4 flex items-center justify-between gap-1">
          {weeklyData.map((day, i) => (
            <div
              key={i}
              data-testid={`weekly-day-${i}`}
              className={`flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold transition-colors
                ${day.active
                  ? 'bg-git-green text-white'
                  : 'bg-slate-100 dark:bg-slate-700/40 text-slate-400 dark:text-slate-500'
                }`}
            >
              {day.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}