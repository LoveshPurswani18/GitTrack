/**
 * githubStats.js — GitTrack stat calculators (Phase 1 rewrite)
 *
 * Key fixes vs original:
 *  1. payload.size  — the real commit count per push (original used
 *     payload.commits.length which GitHub hard-caps at 20).
 *  2. Timezone-safe dates — toLocaleDateString with explicit locale so
 *     commits at 11 pm IST aren't silently reassigned to yesterday.
 *  3. Streak logic — handles "today has no commits yet" correctly;
 *     a streak doesn't break at midnight before you've had a chance to commit.
 *  4. Single source-of-truth date helper — one place to change if you ever
 *     want to switch to UTC display.
 */

// ---------------------------------------------------------------------------
// Date helpers — always work in the user's local wall-clock date
// ---------------------------------------------------------------------------

/** Returns "YYYY-MM-DD" in local timezone for any Date or date string */
function toLocalDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  // Intl gives us a locale-stable format we can control
  return d.toLocaleDateString('en-CA'); // en-CA always formats as YYYY-MM-DD
}

/** Today's local date string */
function today() {
  return toLocalDate(new Date());
}

/** Date string for N days ago (local time) */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDate(d);
}

// ---------------------------------------------------------------------------
// groupCommitsByDay
// Returns a plain object:  { "YYYY-MM-DD": commitCount, ... }
// ---------------------------------------------------------------------------
export function groupCommitsByDay(events) {
  const map = {};

  for (const event of events) {
    // Only care about push events
    if (event.type !== 'PushEvent') continue;

    const dateKey = toLocalDate(event.created_at);

    // payload.size = REAL number of commits in the push.
    // payload.commits is an array capped at 20 by GitHub — never use .length
    // as the commit count.  Fall back to commits.length only if size is absent
    // (very old events in the API occasionally omit it).
    const count =
      event.payload?.size ??
      event.payload?.commits?.length ??
      0;

    if (count > 0) {
      map[dateKey] = (map[dateKey] ?? 0) + count;
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// build30DayData
// Returns an array of 30 objects (oldest → newest):
//   { date: "YYYY-MM-DD", count: number }
// ---------------------------------------------------------------------------
export function build30DayData(commitMap) {
  return Array.from({ length: 30 }, (_, i) => {
    const date = daysAgo(29 - i); // i=0 → 29 days ago, i=29 → today
    const count = commitMap[date] ?? 0;
    return {
      date,
      count,
      commits: count,
      formattedDate: new Date(date + 'T00:00:00').toDateString(),
    };
  });
}

// ---------------------------------------------------------------------------
// calculateStreak
// Returns { currentStreak, longestStreak }
//
// "Current streak" rules:
//   - If today already has commits → count from today backwards.
//   - If today has NO commits yet  → count from yesterday backwards.
//     (So the streak doesn't reset at midnight before you've coded.)
// ---------------------------------------------------------------------------
export function calculateStreak(commitMap) {
  const HISTORY_DAYS = 365; // look back up to a year

  // Build an ordered array of the last N date strings (today first)
  const dates = Array.from({ length: HISTORY_DAYS }, (_, i) => daysAgo(i));

  // --- current streak ---
  // If today is active, start counting from index 0; otherwise from index 1
  const startIdx = commitMap[dates[0]] ? 0 : 1;
  let currentStreak = 0;
  for (let i = startIdx; i < dates.length; i++) {
    if (commitMap[dates[i]]) {
      currentStreak++;
    } else {
      break;
    }
  }

  // --- longest streak (scan the entire history) ---
  let longestStreak = 0;
  let run = 0;
  for (let i = dates.length - 1; i >= 0; i--) { // oldest → newest
    if (commitMap[dates[i]]) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  // Ensure longest is at least as big as current
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}

// ---------------------------------------------------------------------------
// calculateWeeklyData
// Returns data for the current Mon–Sun week.
// Future days have count: null so the UI can render them as "pending".
// ---------------------------------------------------------------------------
export function calculateWeeklyData(commitMap) {
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const todayStr = toLocalDate(now);

  // JS getDay(): 0=Sun 1=Mon … 6=Sat → convert to Mon-based index (0=Mon)
  const jsDay = now.getDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;

  const weekData = DAY_LABELS.map((label, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() - mondayOffset + idx);
    const dateKey = toLocalDate(d);
    const isFuture = d > now && dateKey !== todayStr;

    const count = isFuture ? null : (commitMap[dateKey] ?? 0);
    return {
      label,
      dateKey,
      count,
      commits: count,
      isToday: dateKey === todayStr,
    };
  });

  const elapsed = weekData.filter(d => d.count !== null);
  const activeDays = elapsed.filter(d => d.count > 0).length;
  const weeklyConsistency =
    elapsed.length > 0 ? Math.round((activeDays / elapsed.length) * 100) : 0;

  return { weekData, activeDaysThisWeek: activeDays, weeklyConsistency };
}

// ---------------------------------------------------------------------------
// calculate30DayStats
// Returns totals and the heatmap array for the last 30 days.
// ---------------------------------------------------------------------------
export function calculate30DayStats(commitMap) {
  const heatmapData = build30DayData(commitMap);

  const totalCommits = heatmapData.reduce((s, d) => s + d.count, 0);
  const activeDays = heatmapData.filter(d => d.count > 0).length;
  const missedDays = 30 - activeDays;
  const avgCommitsPerDay = parseFloat((totalCommits / 30).toFixed(1));
  const consistency = Math.round((activeDays / 30) * 100);

  return {
    totalCommits,
    activeDays,
    missedDays,
    avgCommitsPerDay,
    consistency,
    heatmapData,
  };
}

// ---------------------------------------------------------------------------
// processGithubData — single entry point used by Dashboard.jsx
// Pass the raw events array; get back everything the UI needs.
// ---------------------------------------------------------------------------
export function processGithubData(events) {
  const commitMap = groupCommitsByDay(events);

  const { currentStreak, longestStreak } = calculateStreak(commitMap);
  const { weekData, activeDaysThisWeek, weeklyConsistency } =
    calculateWeeklyData(commitMap);
  const stats30 = calculate30DayStats(commitMap);

  const todayCommits = commitMap[today()] ?? 0;

  return {
    commitMap,
    currentStreak,
    longestStreak,
    todayCommits,
    weekData,
    activeDaysThisWeek,
    weeklyConsistency,
    ...stats30,
  };
}
