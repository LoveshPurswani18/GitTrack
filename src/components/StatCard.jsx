import { Card, CardContent } from "../components/ui/card";

export default function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  variant = "default",
}) {
  const isWarning = variant === "warning";

  return (
    <Card
      className="h-full border-slate-200 dark:border-slate-800/80
      bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg"
    >
      <CardContent className="p-5 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`
                p-1.5 rounded-md
                ${isWarning ? "bg-red-500/10" : "bg-git-green/10"}
              `}
            >
              <Icon
                className={
                  isWarning
                    ? "w-4 h-4 text-git-coral"
                    : "w-4 h-4 text-git-green"
                }
                stroke="currentColor"
              />
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </p>
          </div>

          <p className="text-3xl font-mono font-bold text-slate-900 dark:text-white">
            {value}
          </p>
        </div>

        {subtitle && (
          <p
            className={`mt-2 text-sm ${
              isWarning ? "text-git-coral" : "text-git-green"
            }`}
          >
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
