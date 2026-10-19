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

## 2. What the spike decided (13 Oct), and the 19 Oct amendment

- **Commit counts come from the commits themselves, never from GitHub's per-day
  counts.** The spike used the REST commits API on each repo's default branch.
  Since 19 Oct commits are counted from **every branch** (see section 6), because
  most work is on feature and integration branches. The REST author-date results
  of the spike still hold: they are the default-branch subset.
- **GraphQL `contributionsCollection`** is used to find repos with my commits
  and my PRs, and to read the profile's per-day counts. Those counts only cover
  the default branch, are kept as `crossCheck`, are never shown as metrics, and
  are only for debugging: the live-check page compares them with the
  default-branch part of our own commits.
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
  onDefault: boolean;         // found on the repo's default branch; metrics ignore it
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
  windowStart: string;        // now − 364 days (GitHub caps the range at a year)
  windowEnd: string;          // now
  repos: Repo[];
  commits: Commit[];          // every branch, one per sha
  pullRequests: PullRequest[];
  restrictedCount: number;    // from GraphQL; 0 means the token sees everything
  crossCheck: { date: string; count: number }[];  // GitHub's per-day counts, debug only
  supersededCommits: Commit[]; // default-branch commits dropped because my PR's own commits
                               // replace them (squash / rebase merges); debug only, so the
                               // default-branch part of `commits` plus these matches GitHub
};
```

`src/types/profile.ts` holds `Profile`: avatarUrl, name, login, bio, location,
company, followers, following, publicRepos, createdAt, url.

Commit messages are never fetched or stored, because the app doesn't need them.

## 6. Fetching (live mode)

Commits are counted from **every branch** (PRD, Commit definition). `fetchLiveActivity` in
`src/lib/github/live.ts` does this, with the pure mapping and merging in `normalize.ts`:

1. **GraphQL, one call plus PR pages** (`contributionsCollection(from, to)` for the
   last 364 days, plus my user `id`): `commitContributionsByRepository` gives the repos with my
   default-branch commits plus per-day counts for `crossCheck` (first 100 days per repo; debug
   only). `pullRequestContributions` gives my PRs with title, number, url, state, createdAt,
   mergedAt and closedAt, **plus each PR's commits (first 100, with author login) and its
   merge commit (`oid`, parent count)**, paginated 100 at a time.
   `restrictedContributionsCount` is also read.
2. **Repo discovery.** Contributions only know the default branch, so a repo whose work
   lives on branches would be missed. `user.repositories` (owner, collaborator and
   organisation member, ordered by `pushedAt`, newest first) is read page by page until
   `pushedAt` falls before the window. **`Activity.repos` is the union of the contribution
   repos, the repos of my PRs and the discovered repos**, because metrics drop any record whose
   repo is not listed. Hitting the page cap throws, so repos are never silently dropped.
3. **Scan set** = contribution repos plus discovered repos, minus forks and repos without a
   default branch. PR-only repos (open-source repos I do not belong to) are listed but never
   scanned, and their PR commits are not counted.
4. **Branch histories, GraphQL, 5 repos per request** (aliases): every branch under
   `refs/heads/` (50 per page, follow-up queries for repos with more) with
   `history(first: 100, since, author: {id})`, which returns only my commits. A branch with more
   than 100 of my commits in the window (`hasNextPage`) is re-fetched completely with REST:
   `GET /repos/{owner}/{repo}/commits?author={username}&sha={branch}&since=&until=&per_page=100`,
   following `Link` pagination. `since`/`until` are widened by 3 days (they filter on committer
   date) and the real filter is the commit's `author.date` inside the window. A 409 (empty repo)
   means no commits. Any other failure throws, so commits are never silently undercounted.
5. **PR commits.** For PRs in scanned repos, the PR's commits that I authored are added
   (matched on the author login). A PR with more than 100 commits is read through
   `GET /repos/{owner}/{repo}/pulls/{number}/commits` (GitHub lists at most 250). This is what
   keeps squash- and rebase-merged work with deleted branches on its real days.
6. **Merge and de-duplicate** (pure, `normalize.ts`):
   - one commit per `sha`; `onDefault` is true when the sha is in the default branch's history;
   - a PR merged by **squash** (merge commit with one parent) leaves a new default-branch commit
     dated at merge time. When the PR's own commits are present, that merge commit is dropped;
   - a PR merged by **rebase** rewrites shas but keeps author dates, so a default-branch commit
     with the same repo and `authoredAt` as one of the PR's commits is dropped;
   - dropped commits go to `Activity.supersededCommits`, so the default-branch part of
     `commits` plus `supersededCommits` still equals what GitHub counts (the live-check page
     relies on this);
   - a true merge keeps the same shas, so nothing is dropped.
   Commit messages are never read or stored.
7. Map the raw responses with the pure functions in `normalize.ts`. These are
   unit-tested against made-up raw JSON in `fixtures/raw/`.

Requests per uncached load: a few GraphQL calls for the activity and the PRs, a few for
discovery, one per 5 repos for branch histories, plus REST only for busy branches and very
large PRs. Everything is wrapped by the 15 minute cache (section 7).

`client.ts` is the only file that talks to the network. It takes the token as an
argument (`config.ts` is the only place that reads `process.env`) and an injectable
`fetch`, so tests run without a network.

`getProfile()` makes one call to `GET /users/{username}` (`fetchLiveProfile`).

All GitHub code lives in `src/lib/github/`, and each file starts with
`import "server-only"`. No client component imports from it.

## 7. Caching and refresh

- The live path of `getActivity()` and `getProfile()` is wrapped in `"use cache"`
  (in-memory handler) with `cacheTag("github")` and
  `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })`: fresh for 15 minutes,
  then served stale while it refreshes. The fixtures path is **not** cached, because
  the fixture state comes from an env var and its dates are relative to now.
- **Failures are not cached for 15 minutes.** The cached function returns
  `{ ok: true, data }` or `{ ok: false, error }` as plain data and calls
  `cacheLife("seconds")` on failure, so a fixed token or a passed rate limit
  recovers on the next request. The outer function rethrows a real `GitHubError`.
- The in-memory handler may not persist between requests on serverless hosting
  (Vercel). If the launch check (cached load under 2 s) fails there, switch the
  directive to `"use cache: remote"`.
- **Refresh** is a server action in `src/app/actions.ts` that revalidates the
  `github` tag, then calls `router.refresh()` on the client. While it runs, the
  current data stays on screen and the button shows "Refreshing…" (DESIGN.md §8).
- Target: a cached page load under 2 s. An uncached year took 5.95 s in the
  spike (default branch only), so caching is required. The all-branch fetch makes
  more requests (section 6), so its uncached time has to be measured on the
  live-check page and may be higher.

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
components/dashboard/useClientEnvironment.ts   browser clock and timezone (null on the server)
lib/controls.ts       parse/serialise the URL controls, range labels (pure, tested)
```

**Control state**: range, repos (repo filter) and tz live in the URL
(`?range=1m&repos=work&tz=Asia%2FKolkata`) and are updated with
`history.replaceState` in the change handler, so there is no server round trip and links are
shareable. The state is the `Scope` type in code; the URL parameter is `repos`
(DESIGN.md §6.2). Defaults: `range=6m`, `repos=all`, and tz = URL value, then the
browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Missing or invalid values
fall back to the defaults, and the URL is left alone until a control changes.
The tz and the clock are only known in the browser, so `useClientEnvironment()`
returns `null` on the server and during hydration (`useSyncExternalStore`), and
`Dashboard` renders the skeleton until it has a value. That is one frame, and it
avoids a hydration mismatch. The clock is taken once per page load, so "today"
does not roll over past midnight until a reload or the refresh in 3.1.

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
    │   │   ├── live.ts        # fetchLiveActivity / fetchLiveProfile, GraphQL queries
    │   │   ├── fixtures.ts
    │   │   ├── client.ts      # fetch wrapper: auth header, GraphQL + REST, pagination
    │   │   ├── normalize.ts   # raw API JSON → types (pure, tested)
    │   │   ├── errors.ts      # GitHubError, HTTP/GraphQL error classification
    │   │   ├── *.test.ts
    │   │   └── fixtures/
    │   │       ├── activity.json      # made-up: personal repos + work-repo-a, work-repo-b
    │   │       ├── activity-empty.json
    │   │       ├── profile.json
    │   │       └── raw/               # made-up raw API responses for normalize tests
    │   └── metrics/           # pure functions + *.test.ts (section 9)
    ├── test/                  # test-only helpers: factories.ts, fakeFetch.ts
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
- Raw commit entries take `"onDefault": false` for commits that exist only on a feature
  branch (the default is `true`). The fixtures include such commits, some of them today,
  so the fixture dashboard shows today's activity. `supersededCommits` is empty in the
  fixtures.
- Failure states for Playwright come from `GITHUB_FIXTURE_STATE=empty|rate_limit|token_error`,
  which is read only in fixtures mode.
- Never put real WhatBuilds repo names, PR titles or commit data in fixtures.

## 13. Testing and verification

- `pnpm test` runs Vitest on `lib/metrics` and `lib/github/normalize`.
- `pnpm lint` and `pnpm build` must pass before any commit proposal.
- UI: Playwright MCP screenshots at 1280×800 and 390×844, light and dark,
  compared against `docs/design/screens/` (DESIGN.md §12). Always use fixtures.
- Live accuracy, which I run myself (PRD success criterion 1), in `Asia/Kolkata`:
  - the default-branch part of our commits (the `onDefault` ones plus
    `supersededCommits`) matches GitHub's own per-day counts on the live-check page, and
    30 random days and both streaks match my GitHub profile;
  - the all-branch daily counts match `git log --all --author=<me>` per day in a few
    cloned repos, allowing the known rebase gap;
  - squash-merged PRs with deleted branches show their original days;
  - an uncached load stays acceptable (the spike took 5.95 s for the default branch only).
