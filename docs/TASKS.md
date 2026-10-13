# GitTrack v2 — Tasks

The MVP backlog, in build order. One task = one `feat/<branch>` off `v2` = one PR
into `v2`. Work top to bottom; a task starts only when the ones it depends on
are merged.

How to run a task (CLAUDE.md, "Workflow"): plan mode → I approve the plan →
build on fixtures → lint, test, build → Playwright check for UI → coderabbit-review
→ atomic-commit → pr-draft → merge → tick the box here.

Lines marked **(me)** need real data or my accounts. Claude Code stops and asks
me to do them.

---

## Phase 0 — Validation spike ✅ (13 Oct)

- [x] Spike script, run against live data, 9/9 checks pass (`spike/RESULTS.md`)
- [x] PRD updated: IST day grouping, REST commits as the single source of commit counts

## Phase 1 — Foundation and data

### 1.1 Design tokens and app shell · `feat/shell`
- [ ] Tokens from DESIGN.md §3 in `globals.css` (light, dark, `data-theme` override) + `@theme inline`
- [ ] Geist and Geist Mono via `next/font`; tabular numbers utility
- [ ] `layout.tsx`: `AppHeader` (logo, Dashboard/Profile nav, ThemeToggle, avatar placeholder), no-flash theme script
- [ ] Favicon from `public/icon.svg`; page titles
- **Done when:** empty dashboard and profile routes render the header correctly in both themes at 390 and 1280 px; lint and build pass.

### 1.2 Types, config and fixtures · `feat/fixtures`
- [ ] Install and configure Vitest; add the `npm test` script
- [ ] `src/types/activity.ts` and `profile.ts` exactly as ARCHITECTURE.md §5
- [ ] `src/lib/config.ts`: reads and validates env vars; `GITHUB_DATA` defaults to `fixtures`
- [ ] `fixtures/activity.json` (relative dates), `activity-empty.json`, `profile.json`, as ARCHITECTURE.md §12
- [ ] `fixtures.ts` resolves relative dates; `GITHUB_FIXTURE_STATE` for empty, rate_limit and token_error
- [ ] `getActivity()` and `getProfile()` in `lib/github/index.ts`, fixtures path only for now
- **Done when:** a test proves fixture dates resolve relative to `now`, and that fixtures include a 01:00 IST commit, both work repos and all three PR states.

### 1.3 Metrics library · `feat/metrics`
- [ ] `days`, `filter`, `range`, `daily`, `streaks`, `summary`, `projects`, `prs`, `heatmap` (ARCHITECTURE.md §9)
- [ ] Unit tests for each; the required cases: 01:00 IST commit (IST vs UTC day), empty range, streak ending yesterday, streak broken today, Monday week boundary, closed-unmerged PR, scope filter
- **Done when:** `npm test` passes, metrics have no imports from `lib/github` or React, and no `Date.now()` is used inside them.

### 1.4 Live GitHub data layer · `feat/github-live`
- [ ] `client.ts`: auth header, GraphQL + REST helpers, `Link` pagination, up to 6 parallel requests
- [ ] `live.ts`: GraphQL contributions → repos, PRs, crossCheck, restrictedCount; REST commits per repo, filtered by `author.date` (ARCHITECTURE.md §6)
- [ ] `normalize.ts` + tests against made-up raw responses in `fixtures/raw/`
- [ ] `errors.ts`: `token`, `rate_limit`, `network` kinds, plus tests
- [ ] Caching: 15 min, tag `github` (check the installed Next.js caching API in the docs)
- [ ] `import "server-only"` in every file in `lib/github`
- **Done when:** tests pass on fixtures and the build passes. Claude Code never runs live mode.
- [ ] **(me)** Run `GITHUB_DATA=live npm run dev` in my own terminal, load the page, and confirm the year total is within 4% of my profile and a few IST days match.

## Phase 2 — Dashboard

### 2.1 UI primitives · `feat/ui-primitives`
- [ ] `components/ui`: Button, SegmentedControl, TimezoneSelect, StatCard, Heatmap, ProjectList, PRBadge, WorkTag, Banner, Skeleton, ProfileCard (DESIGN.md §6), all props-driven, no data fetching
- [ ] Selected segment changes colour only; focus rings; aria labels on icon buttons
- **Done when:** a temporary `/dev/ui` page (deleted before merge, or excluded from production) shows every primitive in both themes, and it matches the design system.

### 2.2 Dashboard with controls and stats · `feat/dashboard`
- [ ] `page.tsx` → `Dashboard` client component; skeleton until mounted (tz is browser-only)
- [ ] `ControlBar`: range (Today/1W/1M/6M/1Y), repos (All/Personal/Work), TimezoneSelect, Refresh placeholder
- [ ] Control state in the URL (`range`, `scope`, `tz`) via `history.replaceState`; defaults `6m`, `all`, browser tz
- [ ] `StatsRow`: Commits today, This week vs last week, Current streak + longest, Total for range
- **Done when:** switching controls updates every number with no network request; screenshots match `dashboard-desktop` and `dashboard-mobile` (stats and controls) in both themes.

### 2.3 Activity heatmap · `feat/heatmap`
- [ ] `ActivityCard` with `Heatmap`: weeks as columns, Monday first, 5 levels, layouts per range (DESIGN.md §6.5)
- [ ] Tooltip/label per cell: "N commits on <date>"; horizontal scroll on mobile
- **Done when:** the 1Y view matches the design PNG, and the 01:00 IST fixture commit moves between days when the tz changes.

### 2.4 Commits by project · `feat/projects`
- [ ] `ProjectsCard` with `ProjectList`: every repo with commits in range, count, share bar, Work tag
- **Done when:** counts add up to the Total stat, and the Work filter shows only work repos.

### 2.5 Pull requests · `feat/pull-requests`
- [ ] `PullRequestsCard`: opened / open now / merged for the range; recent PR list with title, repo, PRBadge (open, merged, closed), Work tag, link out
- **Done when:** matches the design PNG; the closed-unmerged fixture PR shows the closed badge.

## Phase 3 — Profile, states and launch

### 3.1 Refresh and states · `feat/states`
- [ ] Refresh server action (revalidate `github` tag) + `RefreshButton` with "Refreshing…" state
- [ ] "Updated N min ago" from `fetchedAt`
- [ ] Loading, empty-range, rate-limit (with reset time) and token-error states (DESIGN.md §8), driven by `GITHUB_FIXTURE_STATE`
- [ ] `error.tsx` fallback with Try again
- **Done when:** each state matches its `state-*.png` in both themes.

### 3.2 Profile page · `feat/profile`
- [ ] `/profile`: `ProfileCard` from `getProfile()` (cached like activity), hides empty fields, links to github.com
- [ ] Header avatar uses the profile avatar on both pages
- **Done when:** matches `profile-desktop` in both themes and works at 390 px.
- [ ] **(me)** Check the profile page once in live mode.

### 3.3 Polish and accessibility pass · `feat/polish`
- [ ] Keyboard pass: tab order, focus visible, TimezoneSelect usable by keyboard
- [ ] Contrast spot-check, `prefers-reduced-motion`, no layout shift on load
- [ ] Lighthouse on fixtures: performance and accessibility ≥ 90
- **Done when:** the DESIGN.md §12 checklist passes on every screen.

### 3.4 Deploy · merge `v2` → `main`
- [ ] **(me)** Vercel env vars: `GITHUB_TOKEN`, `GITHUB_USERNAME`, `WORK_ORG`, `GITHUB_DATA=live`; framework preset Next.js
- [ ] **(me)** Merge `v2` into `main`; confirm the production deploy succeeds
- [ ] **(me)** Launch checklist (Rebuild Guide step 8): 30 random IST days + both streaks match my profile; cached load under 2 s; mobile check on my phone
- [ ] **(me)** Keep the URL unshared until auth (PRD risk, accepted 12 Oct)

## After the MVP

Not broken into tasks yet; see the PRD roadmap. In order: auth → MCP read
tools → `/git-track` session logging + database → branch tracking and goals.

## Parking lot

Ideas that come up during the build go here instead of into the current task.

-
