# GitTrack

A personal dashboard for my GitHub commits and pull requests. It shows how much I ship, how
consistently, and where: streaks, a year-long activity heatmap, commits by project and the state of
my pull requests, all grouped into days in the timezone I choose.

It is a single-user app with no database. The server fetches the data from GitHub and caches it for
15 minutes; the browser computes every number, so changing a filter never makes a network request.

## Features

- **Commit counting that matches how I work.** A commit counts if I authored it on any branch of a
  repo I can see (forks excluded), once per commit, so work on feature branches is not hidden. An
  active day has at least one commit; pull requests alone do not count.
- **Stat cards:** commits today, this week against last week, current and longest streak, and the
  total for the selected range.
- **Activity heatmap:** Monday-first weeks for Today, 1 week, 1 month, 6 months and 1 year, with five
  intensity levels, a tooltip on every day and keyboard navigation.
- **Commits by project:** every repo with commits in the range, with counts and share bars.
- **Pull requests:** opened, open now and merged for the range, plus a recent list with status badges.
- **Filters:** personal, work or all repos, and a searchable timezone picker. The selection lives in
  the URL, so a view can be bookmarked.
- **Refresh and resilience:** a manual refresh, an "updated N min ago" label, and clear states for
  loading, no data, rate limits and token problems. The last good data stays on screen when a refresh
  fails.
- **Profile page** with my GitHub details.
- **Private by default:** nothing is shown without an access key, and the session can be locked from
  the header.
- **Light and dark themes,** a skip link and full keyboard support.

## Tech stack

- Next.js (App Router, Cache Components) and React
- TypeScript in strict mode
- Tailwind CSS v4 with a small design-token system, lucide-react icons, Geist and Geist Mono fonts
- GitHub GraphQL and REST APIs, called only from server code
- Vitest for the unit tests (metrics, data layer, access gate)
- pnpm, deployed on Vercel

## Developer information

Built by Lovesh Purswani ([@LoveshPurswani18](https://github.com/LoveshPurswani18)).

Day-to-day commands: `pnpm dev`, `pnpm test`, `pnpm lint` and `pnpm build`. Development runs on
built-in sample data, so no GitHub account is needed to work on the interface.

The metric logic is pure and unit-tested, including the timezone edge cases. Anything that touches
GitHub or the access gate lives on the server only.

More detail is in the project docs:

- [docs/PRD.md](docs/PRD.md): scope, metric definitions, success criteria
- [docs/DESIGN.md](docs/DESIGN.md): design tokens, components, layouts and states
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): data flow and folder structure
- [docs/TASKS.md](docs/TASKS.md): the build backlog
- [spike/RESULTS.md](spike/RESULTS.md): what the validation spike proved about the GitHub API
