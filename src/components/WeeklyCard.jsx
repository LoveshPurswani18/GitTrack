import { Card, CardContent } from "../components/ui/card";

export default function WeeklyCard({
  weeklyData,
  weeklyActiveDays,
  weeklyConsistencyPercent,
}) {
  return (
    <Card
      className="border-slate-200 dark:border-slate-800/80
    bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg"
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Weekly Consistency
          </p>

          <span className="text-sm font-semibold text-git-green">
            {weeklyConsistencyPercent}%
          </span>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          {weeklyActiveDays} / 7 days coded
        </p>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4">
          <div
            className="h-full bg-git-green rounded-full transition-all"
            style={{ width: `${weeklyConsistencyPercent}%` }}
          />
        </div>

        {/* days */}
        <div className="flex justify-between gap-1">
          {(weeklyData || []).slice(0, 7).map((day, i) => (
            <div
              key={i}
              className={`
        w-8 h-8 rounded-md flex items-center justify-center
        text-xs font-semibold transition-all
        ${
          day?.commits > 0
            ? "bg-git-green text-slate-900"
            : "bg-slate-800/60 text-slate-500"
        }
      `}
            >
              {["M", "T", "W", "T", "F", "S", "S"][i]}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
