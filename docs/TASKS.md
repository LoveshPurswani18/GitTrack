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
- [x] PRD updated: IST day grouping, REST commits as the single source of commit counts (default branch only; extended to all branches in 1.5)
- [x] Switched package manager from npm to pnpm (PR merged into v2, 18 Oct)

## Phase 1 — Foundation and data

### 1.1 Design tokens and app shell · `feat/shell`
- [x] Tokens from DESIGN.md §3 in `globals.css` (light, dark, `data-theme` override) + `@theme inline`
- [x] Geist and Geist Mono via `next/font`; tabular numbers utility
- [x] `layout.tsx`: `AppHeader` (logo, Dashboard/Profile nav, ThemeToggle, avatar placeholder), no-flash theme script
- [x] Favicon from `public/icon.svg`; page titles
- **Done when:** empty dashboard and profile routes render the header correctly in both themes at 390 and 1280 px; lint and build pass.

### 1.2 Types, config and fixtures · `feat/fixtures`
- [x] Install and configure Vitest; add the `pnpm test` script
- [x] `src/types/activity.ts` and `profile.ts` exactly as ARCHITECTURE.md §5
- [x] `src/lib/config.ts`: reads and validates env vars; `GITHUB_DATA` defaults to `fixtures`
- [x] `fixtures/activity.json` (relative dates), `activity-empty.json`, `profile.json`, as ARCHITECTURE.md §12
- [x] `fixtures.ts` resolves relative dates; `GITHUB_FIXTURE_STATE` for empty, rate_limit and token_error
- [x] `getActivity()` and `getProfile()` in `lib/github/index.ts`, fixtures path only for now
- **Done when:** a test proves fixture dates resolve relative to `now`, and that fixtures include a 01:00 IST commit, both work repos and all three PR states.

### 1.3 Metrics library · `feat/metrics`
- [x] `days`, `filter`, `range`, `daily`, `streaks`, `summary`, `projects`, `prs`, `heatmap` (ARCHITECTURE.md §9)
- [x] Unit tests for each; the required cases: 01:00 IST commit (IST vs UTC day), empty range, streak ending yesterday, streak broken today, Monday week boundary, closed-unmerged PR, scope filter
- **Done when:** `pnpm test` passes, metrics have no imports from `lib/github` or React, and no `Date.now()` is used inside them.

### 1.4 Live GitHub data layer · `feat/github-live`
- [x] `client.ts`: auth header, GraphQL + REST helpers, `Link` pagination, up to 6 parallel requests
- [x] `live.ts`: GraphQL contributions → repos, PRs, crossCheck, restrictedCount; REST commits per repo, filtered by `author.date` (ARCHITECTURE.md §6; default branch only, replaced by the all-branch fetch in 1.5)
- [x] `normalize.ts` + tests against made-up raw responses in `fixtures/raw/`
- [x] `errors.ts`: `token`, `rate_limit`, `network` kinds, plus tests
- [x] Caching: 15 min, tag `github` (check the installed Next.js caching API in the docs)
- [x] `import "server-only"` in every file in `lib/github`
- **Done when:** tests pass on fixtures and the build passes. Claude Code never runs live mode.
- [x] **(me)** Run `GITHUB_DATA=live pnpm dev` in my own terminal, load the page, and confirm the year total is within 4% of my profile and a few IST days match. (Checked 19 Oct on a temporary `/dev/live-check` page: PR counts, commits and the cache matched; the page stays until 3.5 and returns 404 in production.)

### 1.5 All-branch commits · `feat/all-branches`
Added 19 Oct: most work lives on feature branches, so counting the default branch only
hid it (PRD amendment, CLAUDE.md hard rule). Only the data layer changes; metrics and UI
are untouched.
- [x] Docs first: CLAUDE.md hard rule, PRD (commit definition, accuracy, risks), ARCHITECTURE §2, §5, §6, §12, §13
- [x] `Commit.onDefault` and `Activity.supersededCommits`; fixtures with feature-branch commits (some today)
- [x] `normalize.ts`: branch histories, PR commits, merge and de-duplicate (squash, rebase, true merge, co-authors) with tests
- [x] `live.ts`: user id, repo discovery, batched all-branch histories, REST follow-up for busy branches, PR commits; tests with fake fetch
- [x] `/dev/live-check`: per day, all branches vs default-branch-only vs GitHub; per repo counts; PRs opened today
- **Done when:** tests pass on fixtures and the build passes. Claude Code never runs live mode.
- [x] **(me)** Live checks (19 Oct: GitTrack's all-branch count matched `git log --all` exactly, 21 for the UTC day; work counts looked right; judged good for now), in your own terminal with `GITHUB_DATA=live pnpm dev` on `/dev/live-check`: (1) the default-branch-only column equals GitHub's own count on the days shown; (2) recent `v2` and `feat/*` commits appear on their days; (3) for 2 or 3 cloned repos, `git log --all --author=<me>` per day matches the all-branch column; (4) a squash-merged PR with a deleted branch shows its original days; (5) uncached load time is acceptable

## Phase 2 — Dashboard

### 2.1 UI primitives · `feat/ui-primitives`
- [x] `components/ui`: Button, SegmentedControl, TimezoneSelect, StatCard, Heatmap, ProjectList, PRBadge, WorkTag, Banner, Skeleton, ProfileCard (DESIGN.md §6), all props-driven, no data fetching
- [x] Selected segment changes colour only; focus rings; aria labels on icon buttons
- **Done when:** a `/dev/components` page (404 in production, kept through the build as a reference) shows every primitive in both themes, and it matches the design system.

### 2.2 Dashboard with controls and stats · `feat/dashboard`
- [x] `page.tsx` → `Dashboard` client component; skeleton until mounted (tz is browser-only)
- [x] `ControlBar`: range (Today/1W/1M/6M/1Y), repos (All/Personal/Work), TimezoneSelect, Refresh placeholder (no action until 3.1)
- [x] Control state in the URL (`range`, `repos`, `tz`) via `history.replaceState`; defaults `6m`, `all`, browser tz
- [x] `StatsRow`: Commits today, This week vs last week, Current streak + longest, Total for range
- **Done when:** switching controls updates every number with no network request; screenshots match `dashboard-desktop` and `dashboard-mobile` (stats and controls) in both themes.

### 2.3 Activity heatmap · `feat/heatmap`
- [x] `ActivityCard` with `Heatmap`: weeks as columns, Monday first, 5 levels, layouts per range (DESIGN.md §6.5)
- [x] Tooltip/label per cell: "N commits on <date>"; horizontal scroll on mobile
- [x] Make the per-cell labels reachable: the 2.1 `Heatmap` wrapper has `role="img"`, which hides the cells' `aria-label`s from screen readers. Change the wrapper role (for example `grid`) and make cells focusable with arrow-key movement (DESIGN.md §10)
- **Done when:** the 1Y view matches the design PNG, and the 01:00 IST fixture commit moves between days when the tz changes.

### 2.4 Commits by project · `feat/projects`
- [x] `ProjectsCard` with `ProjectList`: every repo with commits in range, count, share bar, Work tag
- **Done when:** counts add up to the Total stat, and the Work filter shows only work repos.

### 2.5 Pull requests · `feat/pull-requests`
- [x] `PullRequestsCard`: opened / open now / merged for the range; recent PR list with title, repo, PRBadge (open, merged, closed), Work tag, link out
- **Done when:** matches the design PNG, except the PR dot colours (open is GitHub green and merged is a different purple than in the PNG, by choice; see DESIGN.md §13 "Known differences"); the closed-unmerged fixture PR shows the closed badge.

## Phase 3 — Profile, states and launch

### 3.1 Refresh and states · `feat/states`
- [x] Refresh server action (revalidate `github` tag) + `RefreshButton` with "Refreshing…" state
- [x] "Updated N min ago" from `fetchedAt`
- [x] Loading, empty-range, rate-limit (with reset time) and token-error states (DESIGN.md §8), driven by `GITHUB_FIXTURE_STATE`
- [x] `error.tsx` fallback with Try again
- **Done when:** each state matches its `state-*.png` in both themes.

### 3.2 Profile page · `feat/profile`
- [x] `/profile`: `ProfileCard` from `getProfile()` (cached like activity), hides empty fields, links to github.com
- [x] Header avatar uses the profile avatar on both pages
- **Done when:** matches `profile-desktop` in both themes and works at 390 px.
- [x] **(me)** Check the profile page once in live mode.

### 3.3 Polish and accessibility pass · `feat/polish`
- [x] Keyboard pass: tab order, focus visible, TimezoneSelect usable by keyboard
- [x] Contrast spot-check, `prefers-reduced-motion`, no layout shift on load
- [x] Lighthouse on fixtures: performance and accessibility ≥ 90
- **Done when:** the DESIGN.md §12 checklist passes on every screen.

### 3.3a Many-branch repos · `feat/github-error-logging`
Added 29 Oct: live mode failed with "Could not reach GitHub" after I was added to a repo with 1,318 branches.
- [x] `[github]` server log for every failed request and every live fetch (call, status, time, cause; repo and user names masked)
- [x] Request timeout (30 s) and one retry on resets and 502/503/504
- [x] Two-step branch scan: list branch tip dates, fetch history only for active branches; 5,000-branch list cap logged, not thrown
- [x] Tests with fake fetch (retry, timeout, masking, 14-page repo, deleted branch, cap); ARCHITECTURE §6.4 and §8 and the PRD data sources updated
- [x] **(me)** Live check: the page loads with the many-branch repo (uncached load 41.6 s)
- **Done when:** live mode loads without errors and the many-branch repo is counted on every active branch.

### 3.4 Pre-deploy audit · `chore/audit`
Whole-app audit before `v2` goes to `main`, all on one branch. Scaled to a single-user
dashboard that will sit on a public domain with no auth, a write-capable token and work
repo names. Findings are fixed in this branch or logged in the Parking lot with a reason. Claude Code runs everything on
fixtures; **(me)** lines need live data or my accounts.
- [ ] **Secrets and token:** no `NEXT_PUBLIC_` secret; `server-only` in every `lib/github` file; GitHub calls only from server code; token string absent from the `.next/static` client bundle after a build; `.env*` ignored and never in git history; **(me)** swap the classic token for a fine-grained read-only one if it can still see the work org
- [ ] **Company boundary:** search code, fixtures, tests, docs, `spike/`, `dev-test/` screenshots and git history for real work repo names, PR titles and commit messages; **(me)** supply the search terms from a file outside the repo
- [ ] **Exposure if the link leaks:** list exactly what an anonymous visitor can see or trigger (repo names, PR titles, work repos, profile data, Refresh, the raw activity payload in the page HTML or RSC data, any API route or server action); confirm private-repo and work-org data reaches the browser only as far as the UI needs; test with `curl` against a production build with no cookies; **(me)** decide with WhatBuilds in mind whether work repo names and PR titles may appear on a public URL at all, or whether `Work` items should be hidden/obscured until auth exists
- [ ] **Public surface:** `pnpm build && pnpm start`, then `/dev/components` and `/dev/live-check` return 404; security headers (frame, referrer, content-type) and `noindex` set; error and state pages show no stack, token or raw API text; the Refresh server action cannot be abused to burn the rate limit (add a cooldown or document why not)
- [ ] **Dependencies:** `pnpm audit` (prod deps must be clean; the known dev-only `braces` advisory is recorded), unused deps, lockfile consistent, `engines`/`packageManager` match Vercel
- [ ] **Metrics are solid:** every definition in PRD §Metric definitions maps to a pure function and a test (active day, both streaks, this week vs last, range total, per-project share, PR opened/open/merged); add any missing case (empty range, streak ending yesterday vs broken today, Monday week boundary, 01:00 IST commit in UTC vs IST, superseded commits, feature-branch-only commits, fork and duplicate sha); check that stat cards, heatmap, project list and range total always agree for every range, repo scope and timezone; metrics have no `Date.now()` and no React or `lib/github` imports; **(me)** repeat the 30-random-day and streak check on the final build, in step 3.5
- [ ] **Resilience and cost:** each fixture state (empty, `rate_limit`, `token_error`, network) renders correctly; live fetch fails loudly rather than undercounting (the one logged exception is a repo cut at 5,000 branches); uncached load time and GitHub rate-limit use measured via `/dev/live-check` **(me)**; cache is 15 min and Refresh invalidates only the `github` tag
- [ ] **Code health:** `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm build` clean; no `console.log`, dead code or stray TODOs (the `[github]` server logs in `client.ts` and `index.ts` are deliberate); `coderabbit-review` over the full `main...v2` diff, plus `/security-review` as a second pass
- [ ] **Design-system conformance:** repo-wide search for raw hex, `shadow`, blur, gradients and off-scale spacing outside `tokens.css`; mono used for numbers only; quick re-check that 3.3 left every screen and state matching its PNG in both themes at 390 and 1280 px
- [ ] **Repo and docs hygiene:** README describes v2, not the old Vite app; no leftover Vite files, `package-lock.json` or temp files in the `v2` → `main` diff; PRD, ARCHITECTURE and TASKS match what was built; `.coderabbit.yaml` decision from the Parking lot
- [ ] **Deploy readiness:** env var names in ARCHITECTURE §4 match what the code reads; `GITHUB_DATA` cannot reach `live` by accident (preview vs production); **(me)** a Vercel preview with live env loads once before the merge
- [ ] **Auth verdict:** from the exposure findings, recommend in `docs/AUDIT.md` whether authentication must come immediately after the MVP or can wait, with the cheapest stopgap if needed (for example Vercel deployment protection or a shared-secret gate); update the PRD risk row and "After the MVP" order to match
- [ ] Write the results (what was checked, what was found, what was fixed or accepted) into `docs/AUDIT.md`
- **Done when:** every box above is ticked or has an accepted-risk note in `docs/AUDIT.md`, the auth verdict is recorded, and nothing found is rated high.

### 3.5 Deploy · merge `v2` → `main`
- [ ] **(me)** Remove or revisit the `v2` and `feat/*` entries in `vercel.json` (`git.deploymentEnabled`), which turn off Vercel deploys while `main` still holds the old Vite app
- [ ] **(me)** Vercel env vars: `GITHUB_TOKEN`, `GITHUB_USERNAME`, `WORK_ORG`, `GITHUB_DATA=live`; framework preset Next.js
- [ ] **(me)** Merge `v2` into `main`; confirm the production deploy succeeds
- [ ] **(me)** Production build log shows pnpm install (pnpm 12.x), Install Command empty, Node 24.x
- [ ] **(me)** Launch checklist (Rebuild Guide step 8): 30 random IST days + both streaks match my profile; cached load under 2 s; mobile check on my phone
- [ ] **(me)** Keep the URL unshared until auth (PRD risk, accepted 12 Oct)
- [ ] Remove `src/app/dev/live-check` (temporary live-data cross-check page; it returns 404 in production, so it can stay while the core features are built)

## After the MVP

Not broken into tasks yet; see the PRD roadmap. In order: auth → MCP read
tools → `/git-track` session logging + database → branch tracking and goals.

## Parking lot

Ideas that come up during the build go here instead of into the current task.

- [ ] Review `v2` PRs automatically: add a `.coderabbit.yaml` setting that includes `v2` as a base branch (CodeRabbit skips PRs that don't target `main` by default)
- [ ] Replace vite-tsconfig-paths with resolve.tsconfigPaths: true in vitest.config.mts (removes the plugin and the deprecated tsconfck warning)
- [ ] Upgrade ESLint 9 → 10 once eslint-config-next supports it
- [ ] braces advisory GHSA-vfj7-8cjw-p6xm (dev-only, via eslint-config-next): run pnpm audit --fix once a patched version ships
