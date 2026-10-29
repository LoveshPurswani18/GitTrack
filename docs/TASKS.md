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
- [x] **(me)** Run `GITHUB_DATA=live pnpm dev` in my own terminal, load the page, and confirm the year total is within 4% of my profile and a few IST days match. (Checked 19 Oct on a temporary `/dev/live-check` page: PR counts, commits and the cache matched; the page stays until 3.6 and returns 404 in production.)

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

### 3.4 Access key gate · `feat/access-gate`
Added 29 Oct. A single-user gate so the public URL shows nothing without my key: a visible username (my GitHub username, checked against `GITHUB_USERNAME`; public, so it adds no security and is there for the UX and for Apple Passwords autofill) plus a 20+ character random access key kept in Apple Passwords. No auth library, no JWT, no database. Same behaviour in development and production; it fails closed. Design: DESIGN.md §6.12, §6.13, §7.4 and the `unlock-*` screens; mechanics: ARCHITECTURE.md "Access gate".
- [x] `src/proxy.ts` (Node runtime; the app lives under `src/`) runs on every request except `_next/static` and `_next/image`. Without a valid session, page and data reads redirect to `/unlock` and everything else (server actions, API calls) gets a bare 401 with no body; only `/unlock` and a few public files (icon, favicon, `robots.txt`, the two logos) pass. Rules live in the pure, tested `decideAccess`
- [x] Route groups so the unlock page never renders the header or the avatar (the root layout used to fetch the profile on every route): the root layout keeps html, fonts, theme script and skip link; `(app)/` holds the header, Dashboard, Profile, the error page and `dev/`; `(gate)/unlock/` is logo only
- [x] `AUTH_KEY_HASH` (SHA-256 hex of the key) and `AUTH_COOKIE_SECRET` (32+ characters), read by `src/lib/auth/gate.ts` with `GITHUB_USERNAME`. A missing or malformed value makes the gate unavailable: every route shows "GitTrack is unavailable", no variable names on the page, the real reason in the server log only, no values
- [x] Unlock server action: username (exact match with `GITHUB_USERNAME`, capitals count) and key hash compared in constant time, both always computed; a wrong login waits ~1 s and gets one generic message; success sets `gt_session` (`v1.<expiry>.<HMAC-SHA256>`, httpOnly, Secure in production, SameSite=Strict, Path=/, 30 days)
- [x] Lock button in the header (DESIGN.md §6.12): deletes the cookie, then replaces the page with `/unlock` in a full load; a restored back/forward-cache page reloads at once (`BackForwardGuard`); every gated response is `Cache-Control: no-store`
- [x] Three layers: the proxy; `requireSession()` at the top of every server action (except `lock` and `unlock`) and in `getDashboardData` and `getProfileData`, so the data layer refuses on its own even if the proxy is skipped
- [x] Refresh needs a session and has a 60 s cooldown (in memory per instance, best effort); inside it the action quietly does nothing and the data on screen stays
- [x] Tests: cookie (valid, tampered, expired, other secret, malformed), credentials (right, wrong key, wrong username, wrong case, empty, oversize), gate config, `decideAccess` (allow-list, redirect vs 401, unavailable), `requireSession`, unlock action, Refresh cooldown and Lock
- [x] Playwright on fixtures (own server on port 3100, test-only values passed inline): locked → redirect → wrong login → unlock → dashboard with Lock → Lock → Back stays on `/unlock`; unavailable screen with a variable unset; screenshots compared with the PNGs (Unlock desktop light, wrong login light, Unlock mobile dark, unavailable light, the dashboard header on desktop light and mobile dark; the other theme and width combinations are the same components in the other theme); development mode (`pnpm dev`) run on a throwaway copy of the project: cookie not Secure, Lock, no header on `/unlock`; `curl` with no cookie, forged, expired and other-secret cookies
- [x] ARCHITECTURE.md §4 env rows, §10, §11 and a new "Access gate" section with the key rotation runbook
- [ ] **(me)** Add the two placeholder lines to `.env.example` (Claude cannot edit `.env*`); make a separate dev key, hash and secret for `.env.local` (`docs/temp/key-gate-guide.md`, Part B) and unlock once locally; restart a dev server that was already running when this branch arrived (its hot reload showed the old header on the unavailable screen until restarted)
- [ ] **(me)** Create the real key in Apple Passwords (website = the deployed URL, username = my GitHub username), make `AUTH_KEY_HASH` and `AUTH_COOKIE_SECRET` (`docs/temp/key-gate-guide.md`, Part A), and add both in Vercel for **Production and Preview** with the Secret type (write-only after saving); `GITHUB_TOKEN` stays Production only; redeploy
- [ ] **(me)** After this PR merges into `v2`, open the `v2` Preview deployment and prove the gate on a real deployment: locked redirect, unlock, Lock, wrong login
- **Done when:** with no cookie, `curl` to `/`, `/profile`, an RSC request and the Refresh action returns a redirect or 401 and no activity data; the `/unlock` HTML contains no repo names, avatar or profile data; lint, test and build pass; the gate is proved on the Preview.

### 3.5 Pre-deploy audit · `chore/audit`
Whole-app audit before `v2` goes to `main`, all on one branch. Scaled to a single-user dashboard on a public domain behind the access key gate (3.4), with a write-capable classic token and work repo names. Findings are fixed in this branch or logged in the Parking lot with a reason. Claude Code runs everything on fixtures; **(me)** lines need live data or my accounts. Results go into `docs/AUDIT.md`.

Severity, for `docs/AUDIT.md`: **High** = the token or work data is exposed, or the numbers are wrong. **Medium** = a hardening gap. **Low** = cleanup.

**Must pass to deploy**
- [ ] **Secrets and token:** no `NEXT_PUBLIC_` secret; `server-only` in every `lib/github` and `lib/auth` file; GitHub calls only from server code; the token and the `AUTH_*` values absent from the `.next/static` client bundle, the server logs and the error pages; `.env*` ignored and never in git history. **(me)** Classic token kept by decision, recorded as an accepted risk in `docs/AUDIT.md`, with guardrails: dedicated to GitTrack, scopes exactly `repo`, `read:org` and `read:user`, an expiry date with a rotation reminder, stored only locally and in Vercel Production marked Sensitive, revoked at once if leaked
- [ ] **Company boundary:** search code, fixtures, tests, docs, `spike/`, `dev-test/` screenshots and git history for real work repo names, PR titles and commit messages; **(me)** supply the search terms from a file outside the repo
- [ ] **Exposure, verifying the gate:** on a production build with no cookie, `curl` the pages, an RSC request (with the `RSC: 1` header), the Refresh action (`Next-Action` header) and `/unlock`, and confirm no data comes back (3.4 did this on fixtures; repeat on the final build). Then, for an unlocked session, trim what `DashboardView` receives to the fields the UI uses (for example drop `sha`, `crossCheck` and `supersededCommits` unless something reads them) and record what remains (repo names, PR titles and links); **(me)** decide with WhatBuilds in mind whether work repo names and PR titles may appear behind the key at all
- [ ] **Public surface:** `pnpm build && pnpm start` with the `AUTH_*` values passed inline; `/dev/components` and `/dev/live-check` return 404 (or delete `live-check`, see 3.6); security headers (frame, referrer, content-type, permissions) in `next.config.ts`, which has none today; `poweredByHeader: false`; a `robots.txt` that disallows everything, alongside `noindex`; error and state pages show no stack, token or raw API text; verify the Refresh cooldown
- [ ] **Deploy readiness:** env var names in ARCHITECTURE §4 match what the code reads; `GITHUB_DATA=live` set for Production only; `GITHUB_TOKEN` not set for Preview; `AUTH_KEY_HASH` and `AUTH_COOKIE_SECRET` set for Production and Preview; revisit the `vercel.json` entries (`v2: true`, `feat/*` and `chore/*` false). **(me)** The first live check runs on production behind the gate, right after the merge (3.6)
- [ ] **Access gate verification:** a wrong, empty, tampered and expired cookie is refused; the cookie flags are right in the browser; the failure delay is there; a production build with the variables unset shows the unavailable screen and answers 503 to non-page requests; Lock clears the cookie and Back does not show the dashboard
- [ ] **Vercel logs and env:** server-side error logs never include the token or raw GitHub responses; `GITHUB_TOKEN`, `AUTH_KEY_HASH` and `AUTH_COOKIE_SECRET` are set for Production only (the two `AUTH_*` values also for Preview, see above) and use the Secret type
- [ ] **(me)** Branch protection: a GitHub ruleset on `main` and `v2` that blocks force pushes and branch deletion, before the `v2` → `main` merge

**Verify and log**
- [ ] **Dependencies:** `pnpm audit` (prod deps must be clean; the known dev-only `braces` advisory is recorded), unused deps, lockfile consistent, `engines`/`packageManager` match Vercel
- [ ] **Metrics are solid:** every definition in PRD §Metric definitions maps to a pure function and a test (active day, both streaks, this week vs last, range total, per-project share, PR opened/open/merged); add any missing case (empty range, streak ending yesterday vs broken today, Monday week boundary, 01:00 IST commit in UTC vs IST); check that stat cards, heatmap, project list and range total always agree for every range, repo scope and timezone; metrics have no `Date.now()` and no React or `lib/github` imports; **(me)** repeat the 30-random-day and streak check on the final build, in step 3.6
- [ ] **Data layer:** superseded commits, feature-branch-only commits, fork and duplicate sha are tested in `lib/github/normalize`, not in metrics; the branch scan, retry, timeout and log masking added in 3.3a keep their tests
- [ ] **Resilience and cost:** each fixture state (empty, `rate_limit`, `token_error`, network) renders correctly; live fetch fails loudly rather than undercounting (the one logged exception is a repo cut at 5,000 branches); uncached load time and GitHub rate-limit use measured via `/dev/live-check` **(me)** (41.6 s uncached with the many-branch repo on 29 Oct); cache is 15 min and Refresh invalidates only the `github` tag
- [ ] **Code health:** `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm build` clean; no `console.log`, dead code or stray TODOs (the `[github]` and `[gate]` server logs are deliberate); `coderabbit-review` over the full `main...v2` diff, plus `/security-review` as a second pass
- [ ] **Design-system conformance:** repo-wide search for raw hex, `shadow`, blur, gradients and off-scale spacing outside `tokens.css`; mono used for numbers only; quick re-check that every screen and state, including Unlock, matches its PNG in both themes at 390 and 1280 px
- [ ] **Repo and docs hygiene:** README describes v2, not the old Vite app; no leftover Vite files, `package-lock.json` or temp files in the `v2` → `main` diff; PRD, ARCHITECTURE and TASKS match what was built; `.coderabbit.yaml` decision from the Parking lot; the header comment in `src/app/(app)/dev/live-check/page.tsx` points at the right task
- [ ] **Access gate verdict:** confirm 3.4 closes the exposure findings, and record in `docs/AUDIT.md` that full authentication is needed only if the app goes multi-user or public
- [ ] Write the results (what was checked, what was found, what was fixed or accepted) into `docs/AUDIT.md`
- **Done when:** every box above is ticked or has an accepted-risk note in `docs/AUDIT.md`, the access gate verdict is recorded, and nothing found is rated high.

### 3.6 Deploy · merge `v2` → `main`
- [ ] **(me)** Remove or revisit the `v2` and `feat/*` entries in `vercel.json` (`git.deploymentEnabled`), which control Vercel deploys while `main` still holds the old Vite app
- [ ] **(me)** Vercel env vars: `GITHUB_TOKEN` (Production only), `GITHUB_USERNAME`, `WORK_ORG`, `GITHUB_DATA=live` (Production only), `AUTH_KEY_HASH` and `AUTH_COOKIE_SECRET` (Production and Preview, type Secret); framework preset Next.js
- [ ] **(me)** Merge `v2` into `main`; confirm the production deploy succeeds
- [ ] **(me)** Production build log shows pnpm install (pnpm 12.x), Install Command empty, Node 24.x
- [ ] **(me)** Launch checklist (Rebuild Guide step 8): unlock works on production; 30 random IST days + both streaks match my profile; cached load under 2 s; mobile check on my phone
- [ ] **(me)** Share the URL only after the gate is verified (3.4, 3.5)
- [ ] Remove `src/app/(app)/dev/live-check` (temporary live-data cross-check page; it returns 404 in production, so it can stay while the core features are built)

## After the MVP

Not broken into tasks yet; see the PRD roadmap. In order: full authentication (only if the app
goes multi-user or public; the access key gate in 3.4 covers single-user use) → MCP read
tools → `/git-track` session logging + database → branch tracking and goals.

## Parking lot

Ideas that come up during the build go here instead of into the current task.

- [ ] Review `v2` PRs automatically: add a `.coderabbit.yaml` setting that includes `v2` as a base branch (CodeRabbit skips PRs that don't target `main` by default)
- [ ] Replace vite-tsconfig-paths with resolve.tsconfigPaths: true in vitest.config.mts (removes the plugin and the deprecated tsconfck warning)
- [ ] Upgrade ESLint 9 → 10 once eslint-config-next supports it
- [ ] repo-watch alerts for GitTrack: decision pending (see MacBook checklist)
- [ ] Product video with Remotion: after deploy, separate repo gittrack-video, fixture data only
- [ ] Change the access key from the site itself (after the MVP is deployed): a signed-in "Change key" screen that asks for the current key, takes a new one and applies it, replacing the manual steps of making a hash, editing `AUTH_KEY_HASH` in Vercel and redeploying; optionally also rotate the cookie secret to sign every device out. The current design is env-only and has no write path, so this needs one of: a small store for the hash and a session version (for example Vercel Edge Config or KV, which departs from "no database"), or the Vercel REST API with a token to update the variables and trigger a redeploy (a new high-value secret). Decide that first; keep the env values as the fallback so the gate still fails closed
- [ ] braces advisory GHSA-vfj7-8cjw-p6xm (dev-only, via eslint-config-next): run pnpm audit --fix once a patched version ships
