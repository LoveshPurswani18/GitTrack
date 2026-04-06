// Map commit count to heatmap intensity level (0-4)
export const getHeatmapLevel = (commits) => {
  if (commits === 0) return 0;
  if (commits <= 2) return 1;
  if (commits <= 4) return 2;
  if (commits <= 6) return 3;
  return 4;
};

// Dark mode heatmap colors
export const darkHeatmapColors = [
  'bg-slate-800/60',      // Level 0 - no activity
  'bg-green-900/70',      // Level 1 - low
  'bg-green-700/80',      // Level 2 - medium
  'bg-green-500/90',      // Level 3 - high
  'bg-green-400',         // Level 4 - very high
];

// Light mode heatmap colors
export const lightHeatmapColors = [
  'bg-slate-100',         // Level 0 - no activity
  'bg-green-200',         // Level 1 - low
  'bg-green-400',         // Level 2 - medium
  'bg-green-500',         // Level 3 - high
  'bg-green-600',         // Level 4 - very high
];

// Legend items
export const heatmapLegend = [
  { level: 0, label: 'No activity' },
  { level: 1, label: '1-2 commits' },
  { level: 2, label: '3-4 commits' },
  { level: 3, label: '5-6 commits' },
  { level: 4, label: '7+ commits' },
];