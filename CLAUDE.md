# GitTrack v2

Personal dashboard for my GitHub commits and pull requests. Single user, no auth in
the MVP. My global ~/.claude/CLAUDE.md applies here in full (git boundaries, commit
and PR formats, verification, code review). This file only adds what is specific
to this project.

## Docs — read the relevant one before starting a task
- docs/PRD.md — scope, metric definitions, success criteria. What and why.
- docs/DESIGN.md — tokens, components, layouts, states. Read before ANY UI work.
- docs/design/screens/*.png — final screens, light and dark. Match them.
- docs/ARCHITECTURE.md — data flow and folder structure (written after the spike).
- docs/TASKS.md — the backlog. Tick items off when done.
- spike/RESULTS.md — what the validation spike proved about the GitHub API.

## Stack
- Next.js (App Router), TypeScript strict, Tailwind v4, lucide-react, Geist fonts.
- No database. The server fetches GitHub data and caches it for 10–15 minutes.
- Tests: Vitest for all metric logic.

## Commands
- `pnpm dev` — dev server on http://localhost:3000 (fixture data by default)
- `pnpm build` · `pnpm lint` · `pnpm test`

## Work data and the company boundary (CRITICAL)
The app shows my WhatBuilds activity at runtime, but you never touch WhatBuilds
data yourself. The global company boundary stands; this project does not relax it.
- Data comes from one switch: `GITHUB_DATA=fixtures` (default) or `GITHUB_DATA=live`.
- In your sessions, always use fixtures: `.env.local` stays on `fixtures`, and you
  never set or run `live`, never run scripts that call the GitHub API, and never
  run git or gh commands against any WhatBuilds repo.
- Fixtures live in `src/lib/github/fixtures/`, use made-up repo names
  (`work-repo-a`, `work-repo-b`) with `isWork: true`, and cover late-night IST
  commits, feature-branch-only commits (`onDefault: false`), empty ranges,
  rate-limit and token errors.
- Never write a real WhatBuilds repo name, PR title or commit message into code,
  tests, fixtures, docs or commit messages. Treat WORK_ORG as an env value only.
- When a step needs real data (the spike, accuracy checks), write the script or
  checklist, then stop and ask me to run it. I report back pass/fail results.

## Hard rules
- GITHUB_TOKEN is server-only. Never prefix a secret with NEXT_PUBLIC_.
- Never call GitHub from a client component; only from server code in src/lib/github.
- Timestamps stay in UTC; group into days only in the selected timezone.
- A commit counts if I authored it on any branch of a non-fork repo I can see, once per
  sha (changed 19 Oct: most of my work is on feature branches). Each commit carries
  `onDefault` (it is on the repo's default branch) so GitHub's own default-branch counts
  stay usable as a cross-check; the metrics ignore it.
- An active day has at least one commit. PRs alone don't count.
- Metric functions in src/lib/metrics are pure and unit-tested, including a
  late-night IST commit that falls on different days in UTC and Asia/Kolkata.
- Package manager is pnpm. Never run npm install or create a package-lock.json.

## UI rules
- Use only the design tokens (Tailwind classes generated from DESIGN.md section 3).
  No raw hex, off-scale px values, card shadows, blur or gradients.
- Numbers use font-mono with tabular-nums. Mono is for numbers only.
- Build UI from src/components/ui, using the component names in DESIGN.md section 6.
- Selected segments change colour only: no underline, border or shadow.
- Every UI change must work in light and dark, at 390px and 1280px wide.
- Verify with the Playwright MCP against fixture data: screenshot both widths in
  both themes and compare with the matching PNG in docs/design/screens/.

## Workflow for this project
- Start every feature in plan mode and wait for my approval of the plan.
- After writing or revising a plan, post it in chat and wait; don't call ExitPlanMode until I say it's approved.
- One feature per branch off `v2`: `feat/<name>`. PRs target `v2`, not `main`.
- Before proposing commits: `pnpm lint`, `pnpm test`, then the build (global rule).
- Commits: follow the global stopping rule and the `atomic-commit` skill.
- Reviews: `coderabbit-review` skill before I open a PR; `pr-draft` for the PR text.
- If the PRD or DESIGN.md seems unclear or wrong, ask; don't guess.
- When you make the same mistake twice, suggest a one-line rule to add here.
