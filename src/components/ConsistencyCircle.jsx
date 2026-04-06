import { useTheme } from '../context/ThemeContext';

export default function ConsistencyCircle({ percent }) {
  const { isDark } = useTheme();
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const getMessage = (pct) => {
    if (pct >= 85) return "You've maintained an exceptional active rate over the last month. Keep the momentum going!";
    if (pct >= 70) return "Great consistency! You're building a strong coding habit.";
    if (pct >= 50) return "Good progress. Try to code a little more each day.";
    return "Room to improve. Set small daily goals to build consistency.";
  };

  return (
    <div
      data-testid="consistency-circle"
      className="flex flex-col items-center justify-center p-6 h-full"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
        30-Day Consistency
      </p>

      {/* SVG Circle */}
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 1)'}
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#22C55E"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{
              '--target-offset': offset,
              animation: 'circle-draw 1.5s ease-out forwards',
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            data-testid="consistency-percent-value"
            className="text-3xl font-mono font-bold text-slate-900 dark:text-white"
          >
            {percent}%
          </span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">
            Consistency
          </span>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400 max-w-[240px] leading-relaxed">
        {getMessage(percent)}
      </p>
    </div>
  );
}