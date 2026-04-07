import { Card, CardContent } from "../components/ui/card"
import { CheckCircle } from "lucide-react"

export default function TodayCard({ todayCommits, dailyGoal }) {
  const goalMet = todayCommits >= dailyGoal

  return (
    <Card className="border-slate-200 dark:border-slate-800/80
    bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">

      <CardContent className="p-6">

        <div className="flex justify-between items-start mb-2">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Today's Activity
          </p>

          {goalMet && (
            <CheckCircle className="w-4 h-4 text-git-green" />
          )}
        </div>

        <p className="text-sm text-slate-400 mb-2">
          {todayCommits > 0 ? "You coded today" : "No commits yet"}
        </p>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-bold text-git-green">
            {todayCommits}
          </span>
          <span className="text-slate-400">commits</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Goal: {dailyGoal} commit
          </span>

          {goalMet && (
            <span className="text-git-green font-semibold">
              ✓ Goal met
            </span>
          )}
        </div>

      </CardContent>
    </Card>
  )
}