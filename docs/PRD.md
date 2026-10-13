# GitTrack v2 — MVP PRD

Oct 11, 2026 · @Lavesh.Dev

## Overview

GitTrack v2 is a personal dashboard that shows, accurately and at a glance, how consistently I write and ship code across personal and work repos. It replaces the v1 app, whose numbers were wrong because it relied on the GitHub Events API.

**Problem.** I want to build and ship more, but I have no trustworthy view of my coding consistency or where my effort goes. The current tracker shows incomplete and inaccurate numbers, so I don't use it.

**Goals**

1. **Product:** accurate daily commit and PR metrics, streaks and per-project breakdowns for one user, in any timezone.
2. **Validation:** prove the GitHub API can deliver those numbers before building the full app (go/no-go).
3. **Learning:** build the project end to end with Claude Code — specs, planning, implementation, testing and deployment.

**Non-goals for the MVP**

- Authentication or multiple users
- A database or stored history beyond GitHub's own data
- The MCP server, `/git-track` command and session logging
- Branch-level commit tracking
- Open-source contributions to repos I don't belong to
- Signals beyond commits and PRs (deploys, releases, reviews)

## Phase 0: validation spike

Days 1–2 answer one question before any UI is built: can the GitHub API give exact, timezone-aware commit and PR data for all my repos? The spike is a throwaway script or single page; only its findings carry over.

| # | Check | Pass criteria |
| --- | --- | --- |
| 1 | Daily commit counts | In UTC mode, commit counts match my GitHub profile graph on 30 random days |
| 2 | Streaks | Current and longest streak match a manual count from the profile (UTC mode) |
| 3 | Private repos | Private repo commits are included |
| 4 | WhatBuilds org repos | Org commits are included; the token can read them (SSO authorized if required) |
| 5 | Attribution | Recent work commits link to my profile (author email on my account) |
| 6 | PRs | Opened and merged counts match GitHub PR search for the same period |
| 7 | Per-project counts | Commits by repo add up to the total |
| 8 | Timezone regrouping | A commit at 01:00 IST appears on the IST day in IST mode and the previous day in UTC mode |
| 9 | Speed | A one-year fetch completes in a few seconds and can be cached |

**Go:** all checks pass → build on this data layer. **No-go:** any check fails → record which and why, then decide whether a second data source is needed before Phase 1.

## MVP scope

The MVP is a dashboard page, with a timezone switcher, a range selector and a personal/work filter driving every number on it, plus a simple profile page.

| Feature | Requirement | Priority |
| --- | --- | --- |
| Activity heatmap | Daily commit counts for the selected range, built from raw commit timestamps | Must |
| Range selector | Today, 1 week, 1 month, 6 months, 1 year (max) | Must |
| Timezone switcher | Any IANA timezone, defaulting to the browser's; all days, streaks and "today" follow it | Must |
| Streaks | Current and longest streak of active days | Must |
| Summary stats | Commits today, this week vs last week, total for the range | Must |
| Pull requests | Opened, open now and merged for the range, plus recent PRs with title, repo and status; work PRs carry a "Work" tag | Must |
| Commits by project | Per-repo counts for every repo; WhatBuilds repos are named and carry a "Work" tag | Must |
| Personal / work filter | All, personal only, or work only, applied to every metric | Must |
| Refresh and states | Cached data with a manual refresh, plus clear loading, empty, rate-limit and token-error states | Must |
| Redesigned UI | New visual design, light and dark themes, works on mobile | Must |
| Deployment | Deployed on Vercel | Must |

**Profile page (Should).** A second page showing my public GitHub profile: avatar, name, username, bio, location, company, followers and following, public repo count, join date, and a link to github.com/LoveshPurswani18. One call to GitHub's user endpoint, cached like the rest; built in Phase 2 once the dashboard works.

**Out of scope:** everything listed under non-goals, plus a year-by-year history beyond 12 months.

## Metric definitions

Every metric follows GitHub's own counting rules, so in UTC mode the numbers can be checked against my profile.

| Term | Definition |
| --- | --- |
| Commit | A commit I authored (email linked to my GitHub account) on a repo's default branch; fork commits don't count |
| Active day | A day with at least one commit; PRs alone don't make a day active |
| Current streak | Consecutive active days ending today or yesterday, in the selected timezone |
| Longest streak | Longest run of consecutive active days in the fetched data (up to 12 months) |
| PR opened | A PR I created in a repo I belong to, counted on its creation day |
| PR merged | One of those PRs, counted on its merge day |
| Personal repo | Any repo not owned by the WhatBuilds org |
| Work repo | Any repo owned by the WhatBuilds org; shown by name with a "Work" tag, including PR titles and statuses |
| Day | A calendar day in the selected timezone, computed from each event's UTC timestamp |

Commits on feature branches appear only after they are merged into the default branch.

## Architecture and data

A single Next.js app with TypeScript, deployed on Vercel, with no database: the server fetches raw events from GitHub and caches them, and the browser groups them into days for the chosen timezone.

&#91;embedded content: data flow · GitHub → Next.js server → dashboard\]

Raw events are timezone-free, so switching timezone, range or filter never triggers a new GitHub call.

- **Data sources:** GraphQL `contributionsCollection` lists the repos with my commits and my PRs with their timestamps; the REST commits API returns exact commit times per active repo on the default branch, filtered to my author.
- **Token:** one dedicated classic personal access token with `repo` and `read:org`, SSO-authorized for WhatBuilds if needed, separate from my gh CLI login. Stored in a server-only environment variable, never prefixed `NEXT_PUBLIC_`.
- **Caching:** server-side cache of 10–15 minutes, plus a manual refresh. Rate limits are not a concern for one user with caching.
- **Work repos:** WhatBuilds repos are flagged as work on the server and shown by name, with their PR titles and statuses, like personal repos.
- **Data source switch:** `GITHUB_DATA=fixtures` serves made-up sample repos and PRs (tests, and every Claude Code session); `GITHUB_DATA=live` reads GitHub and is used only when I run the app or on Vercel. This keeps WhatBuilds data out of Claude Code sessions, as my global rules require.
- **Later:** a database arrives with session logging, goals or history GitHub can lose (deleted repos, force-pushes).

## Plan and success criteria

The MVP ships within two weeks: a two-day spike gates the build, then three build phases and a two-day buffer.

&#91;embedded content: MVP plan · 4 phases + buffer over 14 days\]

Each phase starts in Claude Code plan mode from this PRD, with `CLAUDE.md` holding the project rules.

**The MVP succeeds when:**

1. **Accuracy:** in UTC mode, daily commit counts and streaks match my GitHub profile on 30 random days.
2. **Speed:** the dashboard loads in under 2 seconds from cache.
3. **Usage:** I open it on most days for the two weeks after launch.
4. **Learning:** the whole cycle — spec, plan, build, test, deploy — was done with Claude Code.

The longer-term measure is whether my active days per week rise in the month after launch.

## Risks, open questions and what comes next

The biggest risk is the data layer, which is why the spike comes first; the rest have simple fallbacks.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Commit counts don't match the profile | Core promise fails | Spike check 1; investigate before any UI work |
| WhatBuilds blocks or hasn't authorized the token | Work commits silently missing | Spike check 4; authorize SSO or ask an org admin |
| No auth on the deployed URL | Anyone with the link sees my activity, repo names and PR titles, including WhatBuilds repos | Accepted for the MVP (decided 12 Oct); auth is the first post-MVP item; keep the URL unshared; confirm WhatBuilds is fine with its repo names and PR titles shown |
| Classic token has write access | A leak could modify repos | Server-only env var, dedicated token, revocable without affecting my gh CLI login |
| A year of commit fetches is slow | Slow first load | Spike check 9; cache results; fetch only repos with activity |

**Open questions**

- Does the REST commits API, filtered to default branches, reproduce GitHub's commit counts exactly? (Answered by the spike.)

**After the MVP, in order**

1. Authentication on the deployed app
2. MCP server with read tools (`get_stats`, `stale_projects`) to query stats from Claude Code
3. `/git-track` session logging, which brings in a database
4. Branch-level tracking, goals, and other shipping signals

**Sources:** [GraphQL contributionsCollection](https://docs.github.com/en/graphql/reference/users) · [Contributions on your profile](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile) · [Why contributions don't show](https://docs.github.com/en/account-and-profile/reference/why-are-my-contributions-not-showing-up-on-my-profile) · [REST search](https://docs.github.com/en/rest/search/search) · [Personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
