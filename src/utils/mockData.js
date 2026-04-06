// Generate realistic mock data for the last 30 days
const generateLast30Days = () => {
  const days = [];
  const today = new Date();

  // Realistic commit patterns - higher on weekdays, some zeros on weekends
  const commitPatterns = [
    6, 3, 8, 5, 7, 2, 0,  // Week 1 (Mon-Sun)
    4, 9, 3, 6, 5, 1, 0,  // Week 2
    7, 4, 8, 0, 6, 3, 2,  // Week 3
    5, 7, 3, 6, 4, 0, 0,  // Week 4
    4, 4                    // Last 2 days
  ];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push({
      date: date.toISOString().split('T')[0],
      commits: commitPatterns[29 - i],
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      formattedDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }

  return days;
};

const dailyData = generateLast30Days();

// Calculate derived stats
const totalCommits = dailyData.reduce((sum, d) => sum + d.commits, 0);
const activeDays = dailyData.filter(d => d.commits > 0).length;
const missedDays = 30 - activeDays;

// Calculate current streak (from today going backwards)
const calculateCurrentStreak = () => {
  let streak = 0;
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (dailyData[i].commits > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

// Calculate longest streak
const calculateLongestStreak = () => {
  let longest = 0;
  let current = 0;
  for (const day of dailyData) {
    if (day.commits > 0) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
};

// Weekly data (current week)
const getWeeklyData = () => {
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const lastSevenDays = dailyData.slice(-7);
  return weekDays.map((label, i) => ({
    label,
    active: lastSevenDays[i]?.commits > 0,
    commits: lastSevenDays[i]?.commits || 0,
  }));
};

const weeklyData = getWeeklyData();
const weeklyActiveDays = weeklyData.filter(d => d.active).length;

export const mockData = {
  username: 'dev_curator',
  avatarUrl: 'https://images.unsplash.com/photo-1566753323558-f4e0952af115?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwyfHx0ZWNoJTIwZGV2ZWxvcGVyJTIwYXZhdGFyJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc1NTA4MTc1fDA&ixlib=rb-4.1.0&q=85&w=80&h=80',
  lastUpdated: '5 mins ago',
  currentStreak: 8,
  longestStreak: 14,
  todayCommits: 4,
  dailyGoal: 1,
  weeklyData,
  weeklyActiveDays,
  weeklyConsistencyPercent: Math.round((weeklyActiveDays / 7) * 100),
  dailyData,
  totalCommits: 142,
  activeDays: 26,
  missedDays: 4,
  consistencyPercent: 88,
  avgCommitsPerDay: 5.4,
  comparisonCommits: '+12% from last month',
  comparisonMissed: '-2 fewer than last month',
  activeDaysTarget: 28,
};