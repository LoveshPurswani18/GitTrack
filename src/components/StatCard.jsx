import { Card, CardContent } from '../components/ui/card';

export default function StatCard({ icon: Icon, label, value, subtitle, variant = 'default' }) {
  return (
    <Card
      data-testid={`stat-card-${label.toLowerCase().replace(/[\s()]/g, '-')}`}
      className="border-slate-200 dark:border-slate-800/80
        bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg"
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-1.5 rounded-md ${
            variant === 'warning'
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <Icon className={`w-4 h-4 ${
              variant === 'warning'
                ? 'text-git-coral'
                : 'text-git-green'
            }`} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
        </div>
        <p
          data-testid={`stat-value-${label.toLowerCase().replace(/[\s()]/g, '-')}`}
          className="text-3xl font-mono font-bold text-slate-900 dark:text-white"
        >
          {value}
        </p>
        {subtitle && (
          <p className={`mt-1 text-sm ${
            variant === 'warning'
              ? 'text-git-coral'
              : 'text-git-green'
          }`}>
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}