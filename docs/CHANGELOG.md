# Changelog

Every release of GitTrack, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the version numbers are
`vMAJOR.MINOR.PATCH`, tagged on `main`.

Entries describe what changed for the person using the app, not every commit. The sections
used are Added, Changed, Fixed, Removed and Security.

Versions 1.0.0 and 2.0.0 were written afterwards from the git history, on 10 Nov 2026; neither
release kept a changelog at the time.

## [Unreleased]

Nothing yet.

## [2.0.1] - 2026-11-27

### Security

- Upgraded Next.js from 16.4.1 to 16.4.6, which fixes seven moderate-severity advisories:
  three cache leaks in `use cache`, an SVG rejection bypass in image optimization, HttpOnly
  cookie exposure on Edge routes, cross-client response injection, and cache poisoning of
  shared fallback shells. The dependency audit now reports no known vulnerabilities in production
  dependencies, and the build check that stopped deploys passes again.

## [2.0.0] - 2026-10-30

A full rewrite as a Next.js app that reads live GitHub data on the server. Tagged `v2.0.0`.
It covers the first production deploy on 29 Oct and the fixes that followed on 30 Oct.

### Added

- Dashboard with stat cards for commits, active days and streaks, a range control from
  Today up to one year, and a filter for personal, work or all repositories. The selection
  is kept in the URL, so a view can be bookmarked.
- Timezone select with search and keyboard support; days are grouped in the chosen timezone.
- Activity heatmap card with keyboard navigation.
- Commits by project card.
- Pull requests card with status.
- Profile page, header avatar and copy-username button.
- Refresh button, "updated" time, and screens for the loading, empty, rate-limit and
  token-error states. A failed refresh keeps the last good data on screen.
- Loading skeletons and a skip link.
- Light and dark themes at phone and desktop widths.
- Access gate: an unlock screen that takes a username and access key, a signed session
  cookie, and a Lock button. Nothing is shown without the key.
- Fixture data mode for development, alongside the live mode used in production.
- Unit tests for all metric logic.

### Changed

- Rebuilt on Next.js (App Router), TypeScript and Tailwind v4, replacing the React and Vite
  app from 1.0.0.
- GitHub is called only from the server, with the token kept server-side and the data cached.
- Commits are counted from every branch of non-fork repositories, once per commit, instead
  of from the public activity feed, which only reached back about 90 days.
- GitHub requests time out and are retried once, and failures are logged.
- Repositories with many branches are scanned on their active branches only.
- The dashboard opens on the Today range.
- The package manager is pnpm.

### Fixed

- The live data cache is shared across serverless instances, so a visit no longer refetches
  everything when it lands on a new instance.

### Security

- The GitHub token is sent only to the GitHub API host.
- Only the data that is displayed, and fixed error messages, are sent to the browser.
- Session cookies with a malformed or non-standard expiry are refused.
- An unrecognised data mode is rejected instead of falling back silently.
- Security headers are sent on every page, and search engines are asked not to index the
  site.
- The live check page also requires an unlocked session.

## [1.0.0] - 2026-05-22

The first version: a client-side React and Vite dashboard. Tagged `v1-react`, before the
`vMAJOR.MINOR.PATCH` tag format was adopted.

### Added

- Single-page dashboard with streak, today, weekly and stat cards.
- Contribution heatmap and a consistency circle.
- GitHub API integration, called from the browser.
- Light and dark theme toggle.
