import { Card, CardContent } from '../components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function TodayCard({ todayCommits, dailyGoal }) {
  const goalMet = todayCommits >= dailyGoal;

  return (
    <Card
      data-testid="today-card"
      className="relative overflow-hidden border-slate-200 dark:border-slate-800/80
        bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg"
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today's Activity
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
              {todayCommits > 0 ? 'You coded today' : 'No commits yet'}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                data-testid="today-commits-value"
                className="text-3xl font-mono font-bold text-git-green"
              >
                {todayCommits}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">commits</span>
            </div>
          </div>
          <div className={`p-2 rounded-lg ${goalMet ? 'bg-green-50 dark:bg-green-900/20' : 'bg-slate-100 dark:bg-slate-800/40'}`}>
            <CheckCircle2 className={`w-5 h-5 ${goalMet ? 'text-git-green' : 'text-slate-400'}`} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Goal: {dailyGoal} commit
          </p>
          {goalMet && (
            <span
              data-testid="goal-met-badge"
              className="flex items-center gap-1 text-xs font-semibold text-git-green"
            >
              <CheckCircle2 className="w-3 h-3" />
              Goal Met
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}