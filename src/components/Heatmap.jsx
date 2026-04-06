import { useTheme } from '../context/ThemeContext';
import { Card, CardContent } from '../components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { getHeatmapLevel, darkHeatmapColors, lightHeatmapColors, heatmapLegend } from '../utils/heatmap';

export default function Heatmap({ dailyData }) {
  const { isDark } = useTheme();
  const colors = isDark ? darkHeatmapColors : lightHeatmapColors;

  return (
    <Card
      data-testid="heatmap-card"
      className="border-slate-200 dark:border-slate-800/80
        bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg"
    >
      <CardContent className="p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-mono font-bold text-base text-slate-900 dark:text-white tracking-tight">
            Last 30 days
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Less</span>
            {heatmapLegend.map((item) => (
              <div
                key={item.level}
                className={`w-3.5 h-3.5 rounded-sm ${colors[item.level]}`}
              />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Heatmap Grid: 3 rows x 10 columns */}
        <TooltipProvider delayDuration={100}>
          <div className="grid grid-cols-10 gap-1.5 md:gap-2">
            {dailyData.map((day, i) => {
              const level = getHeatmapLevel(day.commits);
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      data-testid={`heatmap-cell-${i}`}
                      className={`aspect-square rounded-sm cursor-pointer
                        transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-git-green/40
                        ${colors[level]}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    className="bg-slate-900 dark:bg-slate-800 text-white border-slate-700 text-xs"
                  >
                    <p className="font-semibold">{day.formattedDate}</p>
                    <p className="text-slate-300">
                      {day.commits === 0 ? 'No commits' : `${day.commits} commit${day.commits > 1 ? 's' : ''}`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}