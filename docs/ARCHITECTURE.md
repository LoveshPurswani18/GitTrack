# GitTrack v2 — Architecture

How data gets from GitHub to the screen, and where every piece of code lives.
Read this before any task that touches data, metrics or folder layout. The PRD
says what to build, DESIGN.md says how it looks, and this file says how it fits
together.

## 1. The shape in one picture

```
GitHub GraphQL ──┐
                 ├──► src/lib/github (server only) ──► Activity (raw, UTC) ──► page.tsx ──► <Dashboard> (client)
GitHub REST ─────┘          │                              cached 15 min                       │
                            └── or fixtures (GITHUB_DATA=fixtures)                             ▼
                                                                         src/lib/metrics (pure) in the browser:
                                                                         filter → range → days in tz → stats
```

1. The server fetches **one year of raw activity** once and caches it for
   15 minutes. Raw means plain UTC timestamps, with no days, totals or timezones.
2. The page passes that `Activity` object to one client component.
3. The browser turns it into days, streaks and totals for the chosen timezone,
   range and repo filter. **Changing any control never calls GitHub again.**
   Only Refresh does.

## 2. What the spike decided (13 Oct)

- **Commit counts come from the REST commits API only**: author timestamps on
  each repo's default branch, filtered to my author. This is the single source
  of truth for every commit number in the app.
- **GraphQL `contributionsCollection`** is used to find which repos had my
  commits this year, to get my PRs, and to read the profile's per-day counts.
  Those counts are kept as `crossCheck`, are never shown as metrics, and are only
  for debugging.
- **Days are grouped by author date in the selected timezone.** In
  `Asia/Kolkata` this matches my GitHub profile on 357 of 362 compared days. The
  remaining gap is commits that were rebased off the default branch, which
  GitHub still credits. It is expected; don't try to "fix" it.
- Commits are grouped by `commit.author.date`, never `commit.committer.date`.

## 3. Data source switch

`GITHUB_DATA` picks where `Activity` comes from. It is read once in
`src/lib/github/index.ts`.

| Value | Source | Used by |
| --- | --- | --- |
| `fixtures` (default) | `src/lib/github/fixtures/*.json`, made-up repos and PRs | Tests, every Claude Code session, Playwright checks |
| `live` | GitHub GraphQL + REST with `GITHUB_TOKEN` | Me, running locally; Vercel |

If `GITHUB_DATA` is missing or anything other than `live`, use fixtures.
Claude Code never sets `live` (see CLAUDE.md, "Work data and the company
boundary").

`.env.local` stays on `fixtures` permanently. To see live data, I run
`GITHUB_DATA=live pnpm dev` in my own terminal. A variable set in the shell
wins over `.env.local`, so nothing in the file changes and nothing needs
switching back.

## 4. Environment variables

| Name | Example | Notes |
| --- | --- | --- |
| `GITHUB_TOKEN` | `ghp_…` | Server only. Classic PAT: `repo`, `read:org`, `read:user`. Never `NEXT_PUBLIC_`. |
| `GITHUB_USERNAME` | `LoveshPurswani18` | Author filter and profile lookup |
| `WORK_ORG` | (set in env only) | Repos owned by this org get `isWork: true`. Never hard-code its value. |
| `GITHUB_DATA` | `fixtures` | `fixtures` or `live` |

`src/lib/config.ts` reads and validates these once, server side. In fixtures
mode, `GITHUB_TOKEN` is optional.

## 5. Data model (`src/types/activity.ts`)

```ts
export type Repo = {
  nameWithOwner: string;      // "owner/name"
  url: string;
  isPrivate: boolean;
  isWork: boolean;            // owner === WORK_ORG
  defaultBranch: string;
};

export type Commit = {
  sha: string;
  repo: string;               // Repo.nameWithOwner
  authoredAt: string;         // ISO 8601, UTC — commit.author.date
};

export type PullRequest = {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: "open" | "merged" | "closed";   // closed = closed without merging
  createdAt: string;          // ISO UTC
  mergedAt: string | null;
  closedAt: string | null;
};

export type Activity = {
  username: string;
  fetchedAt: string;          // ISO UTC, shown as "Updated 3 min ago"
  windowStart: string;        // now − 365 days
  windowEnd: string;          // now
  repos: Repo[];
  commits: Commit[];
  pullRequests: PullRequest[];
  restrictedCount: number;    // from GraphQL; 0 means the token sees everything
  crossCheck: { date: string; count: number }[];  // GitHub's per-day counts, debug only
};
```

`src/types/profile.ts` holds `Profile`: avatarUrl, name, login, bio, location,
company, followers, following, publicRepos, createdAt, url.

Commit messages are never fetched or stored, because the app doesn't need them.

## 6. Fetching (live mode)

`getActivity()` in `src/lib/github/live.ts`:

1. **GraphQL, one call** (`contributionsCollection(from, to)` for the last
   365 days): `commitContributionsByRepository` gives the repos with my commits
   (name, owner, url, private, default branch) plus per-day counts for
   `crossCheck`. `pullRequestContributions` gives my PRs with title, number,
   url, state, createdAt, mergedAt and closedAt, paginated.
   `restrictedContributionsCount` is also read.
2. **REST, per repo, in parallel with up to 6 at once**:
   `GET /repos/{owner}/{repo}/commits?author={username}&sha={defaultBranch}&since=&until=&per_page=100`,
   following `Link` pagination. Widen `since`/`until` by 3 days, because these
   filter on committer date, then keep only commits whose `author.date` falls in
   the window. De-duplicate by `sha`.
3. Map the raw responses with the pure functions in `normalize.ts`. These are
   unit-tested against fixture-shaped raw JSON.

`getProfile()` makes one call to `GET /users/{username}`.

All GitHub code lives in `src/lib/github/`, and each file starts with
`import "server-only"`. No client component imports from it.

## 7. Caching and refresh

- Wrap `getActivity()` and `getProfile()` in the installed Next.js version's
  data cache, with a 15-minute lifetime and the tag `github`. Check the Next.js
  docs for the current API (for example `unstable_cache` or `"use cache"` with
  `cacheLife`/`cacheTag`) rather than guessing.
- **Refresh** is a server action in `src/app/actions.ts` that revalidates the
  `github` tag, then calls `router.refresh()` on the client. While it runs, the
  current data stays on screen and the button shows "Refreshing…" (DESIGN.md §8).
- Target: a cached page load under 2 s. An uncached year took 5.95 s in the
  spike, so caching is required.

## 8. Errors

`src/lib/github/errors.ts` defines one error class with a `kind`:

| kind | When | Screen (DESIGN.md §8) |
| --- | --- | --- |
| `token` | 401, or 403 "Bad credentials" / missing token in live mode | Token error banner |
| `rate_limit` | 403 or 429 with `x-ratelimit-remaining: 0`; carry the reset time | Rate-limit banner with reset time |
| `network` | fetch failed or 5xx | Error banner with Try again |

`page.tsx` catches `GitHubError` and renders the matching state. Anything else
goes to `error.tsx`. Error messages never include the token.

## 9. Metrics (`src/lib/metrics/`) — pure, tested, timezone-aware

Every function is pure: data in, data out, with no `Date.now()` inside (ESLint
enforces this, along with no imports from `lib/github`, React or Next). `now` is
passed as an argument so tests are deterministic.

A **day** is a `YYYY-MM-DD` string in the selected timezone. `DayBounds` is
`{ start, end }`, both inclusive. The timezone is assumed to be a valid IANA name,
validated by the caller; an invalid one throws a `RangeError`.

| File | Exports | Notes |
| --- | --- | --- |
| `days.ts` | `toLocalDay(iso \| Date, tz)`, `dayRange(start, end)`, `addDays(day, n)`, `weekday(day)`, `startOfWeek(day)` | `Intl.DateTimeFormat` with explicit year/month/day parts, never hand-parsed. `weekday` is Monday = 0. `addDays` is date-only arithmetic. |
| `filter.ts` | `Scope`, `filterByScope(activity, "all" \| "personal" \| "work")` | Uses `Repo.isWork`. **Commits and PRs whose repo is not in `Activity.repos` are dropped in every scope**, so work data can't leak into Personal. |
| `range.ts` | `Range`, `DayBounds`, `RANGE_DAYS`, `rangeBounds(range, now, tz)`, `inBounds(day, bounds)` | **Rolling days ending today** in the tz: `today` 1, `1w` 7, `1m` 30, `6m` 182, `1y` 365. |
| `daily.ts` | `dailyCounts(commits, tz, bounds)`, `activeDays(commits, tz)` | `Map<day, count>`, zero-filled for the heatmap |
| `streaks.ts` | `currentStreak(commits, tz, now)`, `longestStreak(commits, tz)` | Current streak ends today or yesterday (PRD). Both ignore the selected range and use all commits passed in, so they are capped by the 365-day fetch window. |
| `summary.ts` | `commitsToday`, `thisWeekVsLast(commits, tz, now)`, `totalInRange` | Weeks start Monday. This week is Monday → today, compared with the **same span** last week (Monday → the same weekday). |
| `projects.ts` | `commitsByRepo(activity, tz, bounds)` | Sorted by count desc, then name; carries `url` and `isWork`. Skips repos not in `Activity.repos`. |
| `prs.ts` | `prStats(prs, tz, bounds)`, `recentPrs(prs, tz, bounds, limit = 5)` | Opened (by createdAt), merged (by mergedAt) in range; open now ignores the range. `recentPrs` lists PRs opened in range, newest first. |
| `heatmap.ts` | `Cell = { day, count, level }`, `Level`, `Thresholds`, `heatmapGrid(daily, bounds)`, `levelThresholds(counts)`, `level(count, thresholds)` | Week columns from the Monday of `bounds.start`, Monday-first rows; days outside the bounds are `null`. |

**Heatmap levels** are quartiles of the active days (count > 0) in the shown range.
`levelThresholds` sorts those counts and takes the nearest-rank values at 25%, 50%
and 75% (`t1`, `t2`, `t3`) plus the maximum. `level` returns 0 for no commits,
always 4 for the busiest day, and otherwise `1 +` the number of `t1`/`t2`/`t3`
strictly below the count, so duplicate thresholds with few active days still give
a sensible 1–4.

Required tests include a commit at **01:00 IST**, which lands on the IST day in
`Asia/Kolkata` and on the previous day in `UTC`, plus empty ranges, a streak
that ends yesterday, a week boundary on Monday (00:30 IST is this week in IST and
last week in UTC), and a closed-unmerged PR.

## 10. Page and component flow

```
app/layout.tsx         fonts, theme script (data-theme before paint), <AppHeader>
app/page.tsx           server: getActivity() → <Dashboard activity={…} />, or the error state
app/loading.tsx        skeleton dashboard (DESIGN.md §6.10)
app/profile/page.tsx   server: getProfile() → <ProfileCard>
components/dashboard/Dashboard.tsx   "use client": holds range, scope, tz; runs metrics in useMemo
```

**Control state**: range, scope (repo filter) and tz live in the URL
(`?range=1m&scope=work&tz=Asia%2FKolkata`) and are updated with
`history.replaceState`, so there is no server round trip and links are
shareable. Defaults (DESIGN.md §6.2): `range=6m`, `scope=all`, and tz = URL value, then the
browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`). The tz is
only known in the browser, so `Dashboard` renders the skeleton until it has
mounted. That is one frame, and it avoids a hydration mismatch.

**Theme**: follows the system; the header toggle sets `data-theme` on `<html>`
and saves it to `localStorage` (DESIGN.md §9). A tiny inline script in
`layout.tsx` applies the saved theme before paint.

## 11. Folder structure

```
.
├── CLAUDE.md
├── docs/
│   ├── PRD.md  DESIGN.md  ARCHITECTURE.md  TASKS.md
│   └── design/screens/*.png
├── spike/                     # dev tool from Phase 0; never imported by the app
│   ├── spike.mjs
│   └── RESULTS.md
├── public/
│   ├── icon.svg  logo-ink.svg  logo-white.svg
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css        # tokens + @theme inline (DESIGN.md §3.6)
    │   ├── page.tsx
    │   ├── loading.tsx
    │   ├── error.tsx
    │   ├── actions.ts         # refresh server action
    │   └── profile/
    │       ├── page.tsx
    │       └── loading.tsx
    ├── components/
    │   ├── ui/                # DESIGN.md §6 primitives, no data logic
    │   │   ├── Button.tsx  SegmentedControl.tsx  TimezoneSelect.tsx
    │   │   ├── StatCard.tsx  Heatmap.tsx  ProjectList.tsx  PRBadge.tsx
    │   │   └── WorkTag.tsx  Banner.tsx  Skeleton.tsx  ProfileCard.tsx
    │   ├── layout/
    │   │   ├── AppHeader.tsx
    │   │   └── ThemeToggle.tsx
    │   └── dashboard/         # composes ui/ with metrics
    │       ├── Dashboard.tsx  ControlBar.tsx  StatsRow.tsx
    │       ├── ActivityCard.tsx  ProjectsCard.tsx  PullRequestsCard.tsx
    │       └── RefreshButton.tsx  States.tsx
    ├── lib/
    │   ├── config.ts          # env parsing, server only
    │   ├── github/            # server only
    │   │   ├── index.ts       # getActivity / getProfile, picks fixtures or live, caching
    │   │   ├── live.ts
    │   │   ├── fixtures.ts
    │   │   ├── client.ts      # fetch wrapper: auth header, GraphQL + REST, pagination
    │   │   ├── normalize.ts   # raw API JSON → types (pure, tested)
    │   │   ├── errors.ts
    │   │   ├── *.test.ts
    │   │   └── fixtures/
    │   │       ├── activity.json      # made-up: personal repos + work-repo-a, work-repo-b
    │   │       ├── activity-empty.json
    │   │       ├── profile.json
    │   │       └── raw/               # made-up raw API responses for normalize tests
    │   └── metrics/           # pure functions + *.test.ts (section 9)
    └── types/
        ├── activity.ts
        └── profile.ts
```

## 12. Fixtures

- Dates are **relative to now** when loaded (stored as offsets such as
  `{ daysAgo: 3, time: "01:15+05:30" }` and resolved by `fixtures.ts`), so
  "today" and streaks always have data.
- They cover personal and work repos (`work-repo-a`, `work-repo-b`,
  `isWork: true`), a late-night IST commit, an active streak that ends
  yesterday, open, merged and closed PRs, and enough history for the 1Y heatmap.
- Failure states for Playwright come from `GITHUB_FIXTURE_STATE=empty|rate_limit|token_error`,
  which is read only in fixtures mode.
- Never put real WhatBuilds repo names, PR titles or commit data in fixtures.

## 13. Testing and verification

- `pnpm test` runs Vitest on `lib/metrics` and `lib/github/normalize`.
- `pnpm lint` and `pnpm build` must pass before any commit proposal.
- UI: Playwright MCP screenshots at 1280×800 and 390×844, light and dark,
  compared against `docs/design/screens/` (DESIGN.md §12). Always use fixtures.
- Live accuracy, which I run myself: in `Asia/Kolkata`, compare 30 random days and
  both streaks with my GitHub profile (PRD success criterion 1).
