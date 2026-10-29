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
switching back. The access gate's three values (section 4) also live in `.env.local`; the gate
applies in every data mode.

## 4. Environment variables

| Name | Example | Notes |
| --- | --- | --- |
| `GITHUB_TOKEN` | `ghp_…` | Server only. Classic PAT: `repo`, `read:org`, `read:user`. Never `NEXT_PUBLIC_`. |
| `GITHUB_USERNAME` | `LoveshPurswani18` | Author filter and profile lookup |
| `WORK_ORG` | (set in env only) | Repos owned by this org get `isWork: true`. Never hard-code its value. |
| `GITHUB_DATA` | `fixtures` | `fixtures` or `live`. Unset means `fixtures`; any other value makes the server throw, so a typo in Vercel fails loudly instead of showing sample data. |
| `GITHUB_FIXTURE_STATE` | `rate_limit` | Fixtures mode only, for Playwright: `empty`, `rate_limit` or `token_error`. Ignored in live mode. |
| `AUTH_KEY_HASH` | 64 hex characters | Access gate: the SHA-256 of the access key, lowercase hex. Server only; type Secret in Vercel (write-only after saving). |
| `AUTH_COOKIE_SECRET` | 32+ random characters | Access gate: signs the session cookie (`openssl rand -base64 32`). Server only; type Secret in Vercel (write-only after saving). |

`src/lib/config.ts` reads and validates the GitHub values once, server side. In fixtures
mode, `GITHUB_TOKEN` is optional. The access gate reads `AUTH_KEY_HASH`, `AUTH_COOKIE_SECRET`
and `GITHUB_USERNAME` itself (`src/lib/auth/gate.ts`) and never throws: a missing or malformed
value makes the gate unavailable (section 14). The gate applies in every mode, so `.env.local`
needs these three values to run `pnpm dev`. `.env.example` lists the names with placeholders.

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
company, followers, following, publicRepos, createdAt, url, and `fetchedAt` (when it was
fetched, shown as "Updated N min ago"; taken inside the cached function in live mode).

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
4. **Branch scan, two GraphQL steps.** GitHub gives no usable order for branches (ordering by
   commit date is ignored), and one repo can have over a thousand, so the scan does not page
   through history.
   - *Step A, list (light):* 5 repos per request (aliases), every branch under `refs/heads/`
     with only its name and tip `committedDate`, 100 per page, follow-up queries for repos with
     more. A branch whose tip is older than the window start (minus the 3-day pad) cannot hold a
     commit in it, so only branches with a tip inside the window are kept as *active*. A safety
     cap of 5,000 branches per repo logs `[github] branch list cut at 5000 branches of :repo` and
     carries on with what was listed. This is the one place the scan can undercount.
   - *Step B, history (active branches only):* per repo, up to 25 named branches per request
     (`ref(qualifiedName:)` aliases), 6 requests at once, each with
     `history(first: 100, since, author: {id})`, which returns only my commits. A branch deleted
     since step A comes back null and is skipped.
   - A branch with more than 100 of my commits in the window (`hasNextPage`) is re-fetched
     completely with REST:
     `GET /repos/{owner}/{repo}/commits?author={username}&sha={branch}&since=&until=&per_page=100`,
     following `Link` pagination. `since`/`until` are widened by 3 days (they filter on committer
     date) and the real filter is the commit's `author.date` inside the window. A 409 (empty repo)
     means no commits. Any other failure throws, so commits are never silently undercounted
     (apart from the logged 5,000-branch cap above).
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

`getProfile()` makes one call to `GET /users/{username}` (`fetchLiveProfile`). The profile page
and the header avatar read it through `getProfileData()` (`src/lib/github/profile.ts`), which
returns `ok` or `error`. A failed profile fetch shows a banner and no card (DESIGN.md §8), so
there is no last-good fallback as on the dashboard.

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
- **Refresh** is a server action in `src/app/actions.ts` that calls `updateTag("github")`
  (immediate expiry, so the next render refetches instead of serving stale data first), then
  `router.refresh()` runs on the client. While it runs, the current data stays on screen and the
  button shows "Refreshing…" (DESIGN.md §8). When the refreshed data arrives, `DashboardView`
  retakes the browser clock so "today", the week and "Updated N min ago" move on.
- **The browser gets a trimmed copy.** `toActivityView` (`dashboard.ts`) cuts the Activity down to
  `ActivityView` (`src/types/activity.ts`): repo name, url and `isWork`; commit repo and time; the
  pull requests; `fetchedAt`. Shas, `onDefault`, `crossCheck`, `supersededCommits`, window bounds,
  `restrictedCount` and the username never leave the server. `/dev/live-check` is the only reader
  of the full Activity.
- **A failed refresh keeps the last good data.** `getDashboardData()` in
  `src/lib/github/dashboard.ts` wraps `getActivity()` and returns a `DashboardResult`
  (`src/types/dashboard.ts`): `ok` (fresh data), `stale` (the last good Activity plus the error)
  or `error` (nothing cached). The last good Activity is kept in server memory, like the cache
  itself, so after a restart followed by a failure the user sees "No data to show".
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

`getDashboardData()` turns a `GitHubError` into a `stale` or `error` result and `DashboardView`
renders the matching banner (`stateCopy.ts` holds the wording; times are shown in the browser's
timezone). Anything that is not a `GitHubError` (bad configuration, a bug) is rethrown to
`error.tsx`, which shows a generic message with no details. Error messages never include the
token. The browser gets only the kind, the reset time and a fixed message per kind
(`toDashboardError` in `dashboard.ts`); GitHub's own text, which can name a private repo, stays in
the server log.

Every request in `client.ts` has a 30 second timeout. A request that throws (reset, timeout) or
gets a 502, 503 or 504 is retried once after a second; token errors, rate limits and other
statuses are not. Each failed request writes one `[github]` line to the server log (kind, call,
status, time, reason) and each live fetch logs its outcome. Repo and user names are masked in
those lines (`redactForLog`), so they are safe to paste.

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
proxy.ts               the access gate's first layer, before every route (section 14)
app/layout.tsx         fonts, theme script (data-theme before paint), skip link; no header
app/(app)/layout.tsx   signed-in pages: <AppHeader> with the Lock button, <BackForwardGuard>
app/(app)/page.tsx     server: getDashboardData() → <DashboardView result={…} />; title row with <UpdatedAgo>; the skeleton (DESIGN.md §6.10) is its Suspense fallback
app/(app)/profile/page.tsx   server: getProfileData() → <ProfileView> (card + caption, or a banner)
app/(app)/error.tsx    fallback for non-GitHub failures (keeps the header and Lock)
app/(gate)/unlock/     the only page without a session: logo, <UnlockForm> or "GitTrack is unavailable"
components/layout/HeaderAvatar.tsx   server: the profile avatar for <AppHeader>, neutral circle on failure
components/dashboard/DashboardView.tsx   "use client": ok / stale / error → dashboard, banner + dashboard, or banner + no-data card
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
├── .coderabbit.yaml           # lets CodeRabbit review PRs that target v2
├── next.config.ts             # security headers, no X-Powered-By (section 15)
├── docs/
│   ├── PRD.md  DESIGN.md  ARCHITECTURE.md  TASKS.md
│   └── design/screens/*.png
├── spike/                     # dev tool from Phase 0; never imported by the app
│   ├── spike.mjs
│   └── RESULTS.md
├── public/
│   ├── icon.svg  logo-ink.svg  logo-white.svg  robots.txt
└── src/
    ├── proxy.ts               # access gate, first layer (section 14)
    ├── app/
    │   ├── layout.tsx         # fonts, theme script, skip link
    │   ├── globals.css        # tokens + @theme inline (DESIGN.md §3.6)
    │   ├── actions.ts         # server actions: refreshData (session + 60 s cooldown), lock
    │   ├── (app)/             # signed-in pages, with the header
    │   │   ├── layout.tsx  page.tsx  error.tsx
    │   │   ├── profile/page.tsx
    │   │   └── dev/           # dev-only pages, 404 in production
    │   └── (gate)/unlock/     # page.tsx, UnlockForm.tsx, actions.ts (unlock)
    ├── components/
    │   ├── ui/                # DESIGN.md §6 primitives, no data logic
    │   │   ├── Button.tsx  SegmentedControl.tsx  TimezoneSelect.tsx
    │   │   ├── StatCard.tsx  Heatmap.tsx  ProjectList.tsx  PRBadge.tsx
    │   │   └── WorkTag.tsx  Banner.tsx  Skeleton.tsx  ProfileCard.tsx  Avatar.tsx  TextInput.tsx
    │   ├── layout/
    │   │   ├── AppHeader.tsx  HeaderAvatar.tsx
    │   │   └── ThemeToggle.tsx  LockButton.tsx  BackForwardGuard.tsx
    │   ├── profile/
    │   │   └── ProfileView.tsx
    │   └── dashboard/         # composes ui/ with metrics
    │       ├── Dashboard.tsx  ControlBar.tsx  StatsRow.tsx
    │       ├── ActivityCard.tsx  ProjectsCard.tsx  PullRequestsCard.tsx
    │       ├── DashboardView.tsx  RefreshButton.tsx  UpdatedAgo.tsx
    │       └── States.tsx  stateCopy.ts
    ├── lib/
    │   ├── config.ts          # env parsing, server only
    │   ├── refreshCooldown.ts # canRefresh: the 60 s Refresh cooldown (pure)
    │   ├── auth/              # access gate, server only
    │   │   ├── gate.ts        # AUTH_* + GITHUB_USERNAME → ready or unavailable
    │   │   ├── cookie.ts      # sign and verify the gt_session pass
    │   │   ├── credentials.ts # username + key check
    │   │   ├── access.ts      # decideAccess: the proxy's rules (pure)
    │   │   ├── session.ts     # requireSession, startSession, endSession (next/headers)
    │   │   └── *.test.ts
    │   ├── github/            # server only
    │   │   ├── index.ts       # getActivity / getProfile, picks fixtures or live, caching
    │   │   ├── dashboard.ts   # getDashboardData: ok / stale (last good data) / error
    │   │   ├── profile.ts     # getProfileData: ok / error
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

- `pnpm test` runs Vitest on `lib/metrics` and `lib/github` (normalize, the client with a fake `fetch`, errors, live fetch and the dashboard states).
- `pnpm lint` and `pnpm build` must pass before any commit proposal.
- UI: Playwright MCP screenshots at 1280×800 and 390×844, light and dark,
  compared against `docs/design/screens/` (DESIGN.md §12). Always use fixtures. The gate applies:
  run your own server on another port with throwaway `AUTH_KEY_HASH`, `AUTH_COOKIE_SECRET` and
  `GITHUB_USERNAME` passed inline (never the real ones, never the user's dev server), unlock,
  then screenshot.
- Access gate checks that are not unit tests: `curl` with no cookie, a forged, an expired and an
  other-secret cookie against a production build (`pnpm build && pnpm start`) must redirect or
  answer 401 with no data; a server action's id posted to another path must not run it.
- Live accuracy, which I run myself (PRD success criterion 1), in `Asia/Kolkata`:
  - the default-branch part of our commits (the `onDefault` ones plus
    `supersededCommits`) matches GitHub's own per-day counts on the live-check page, and
    30 random days and both streaks match my GitHub profile;
  - the all-branch daily counts match `git log --all --author=<me>` per day in a few
    cloned repos, allowing the known rebase gap;
  - squash-merged PRs with deleted branches show their original days;
  - an uncached load stays acceptable (the spike took 5.95 s for the default branch only).

## 14. Access gate

A single-user gate so the public URL shows nothing without my key (task 3.4; the screens are
DESIGN.md §7.4). No auth library, no JWT, no database.

**Login.** A visible username (my GitHub username, compared with `GITHUB_USERNAME`
exactly, capitals included, surrounding spaces ignored; it is public, so it adds no security and exists for the layout and for
Apple Passwords autofill) and the access key (20+ random characters kept in Apple Passwords).
`AUTH_KEY_HASH` holds the SHA-256 of the key as 64 lowercase hex characters; the key itself is
never stored. `checkCredentials` hashes the typed key (exactly as typed, no trimming), compares
the digests in constant time, and always runs both the username and the key comparison. A wrong
login waits about a second and gets one message, "That username or key didn't work. Try again.",
whichever part was wrong.

**The pass.** On success the server sets cookie `gt_session` = `v1.<expiry in epoch
seconds>.<base64url HMAC-SHA256 of "v1.<expiry>" keyed with AUTH_COOKIE_SECRET>`: `httpOnly`
(no script can read it), `Secure` in production, `SameSite=Strict`, `Path=/`, `Max-Age` 30
days. It is stateless: nothing is stored server side, and `verifySession` accepts a pass only
if the signature matches (constant-time compare) and the expiry has not passed.

**Three layers** (each works without the others):

| Layer | Where | What it does |
| --- | --- | --- |
| 1. Proxy | `src/proxy.ts`, rules in `decideAccess` | Runs before every route except `_next/static` and `_next/image`. No pass: page and data reads (GET/HEAD) redirect to `/unlock`; any other method (server actions, API calls) gets a bare 401 with no body. Only `/unlock` and `/icon.svg`, `/favicon.ico`, `/robots.txt`, `/logo-ink.svg`, `/logo-white.svg` pass. Every response it handles is `Cache-Control: no-store`. A valid pass on `/unlock` redirects to `/`. |
| 2. Server actions | `requireSession()` first line of `refreshData` | A server action is a POST to the page it is used on, so a proxy matcher that skips a path skips its actions too. Every action calls `requireSession()` itself, except `unlock` (it starts the session) and `lock` (deleting a missing pass changes nothing). **New actions must call it.** |
| 3. Data layer | `getDashboardData`, `getProfileData` | Both call `requireSession()` before any data is read, so the data refuses on its own even if the proxy is skipped. |

**Not configured: it fails closed.** If `AUTH_KEY_HASH` (64 hex), `AUTH_COOKIE_SECRET` (32+
characters) or `GITHUB_USERNAME` is missing or malformed, `parseGate` returns `unavailable`.
Page reads then get the unlock page showing only "GitTrack is unavailable" (the proxy rewrites
to it; Next ignores a status set on a rewrite, so that page answers 200), every other request
gets a real 503, `unlock` always fails, and `requireSession` always redirects. The reason is
logged once as `[gate] unavailable ...` naming the variable, never a value. This applies in
development too: there is no gate-off mode, so `.env.local` needs the three values.

**Lock.** `lock` deletes the cookie, then the page is replaced (`location.replace`, a full
load) with `/unlock`: the signed-in page leaves the history, the browser keeps no copy in
memory, and a page restored from the back/forward cache reloads at once (`BackForwardGuard`),
which goes through the proxy again. Other tabs of the same browser keep what they show until
their next request, which is redirected.

**Refresh.** `refreshData` needs a session and ignores a call within 60 s of the last one
(`canRefresh`): the data on screen stays, nothing is shown. The timestamp is in server memory,
so on a serverless host each instance counts for itself (best effort, protecting the GitHub
rate limit).

**Limits, stated plainly**
- The pass is not stored server side, so one pass cannot be revoked on its own. Lock removes it
  from this browser; a copy taken from a device stays valid until it expires. To end every
  session at once, change `AUTH_COOKIE_SECRET`.
- The ~1 s failure delay slows guessing but is not a rate limit. The key's strength (20+ random
  characters) is what protects it.
- The username is public and is not a second factor.
- The Refresh cooldown is per instance.

**Rotating (full steps with commands: `docs/temp/key-gate-guide.md`, kept local)**
- *New key:* make a new key, hash it, set `AUTH_KEY_HASH` in Vercel (Production and Preview),
  redeploy. New unlocks need the new key; passes already issued stay valid.
- *End all sessions:* set a new `AUTH_COOKIE_SECRET` and redeploy; every pass stops working.
- *Key exposed:* do both.
- *Local development:* the same three values in `.env.local`, with a separate dev key.

## 15. Public surface (added in the 3.5 audit)

- `next.config.ts` sets `poweredByHeader: false` and, on every response: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a
  `Permissions-Policy` that turns off camera, microphone, geolocation, payment and USB, HSTS, and a
  partial CSP (`frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`).
  The CSP sets no `script-src`: the inline theme script would need a per-request nonce, which forces
  dynamic rendering and defeats `cacheComponents` (an accepted risk).
- `public/robots.txt` disallows everything and the root metadata sets `noindex, nofollow`. The gate
  already lets `/robots.txt` through.
- `/dev/components` and `/dev/live-check` return 404 in production; `live-check` also calls
  `requireSession()`.
- `client.ts` only sends the token to `https://api.github.com`: a full URL from a caller or a
  `Link: rel="next"` header on another host is refused.
