# Spike results

Run of `spike/spike.mjs` against live data, 13 Oct 2026. Work repo names are
replaced with `work-repo-a` … `work-repo-f`; work commit hashes and times are
left out.

## Run

| Item | Value |
| --- | --- |
| User | LoveshPurswani18 |
| Window | 2025-10-14T20:55:22Z → 2026-10-13T20:55:22Z (364 days) |
| REST fetch | widened by 3 days each side, then filtered in the script |
| Active repos | 17 found by GraphQL, 17 fetched via REST |
| Today | 2026-10-13 (UTC), 2026-10-14 (IST) |

## Verdict by check

| # | Check | Result | Notes |
| --- | --- | --- | --- |
| 1 | Daily commit counts | Closest match: IST author date | 5 mismatching days of 362 compared (10 commits). UTC grouping: 24 days off |
| 2 | Streaks | Match in IST | Current 2, longest 6 for GraphQL and REST. UTC gives longest 11 |
| 3 | Private repos | Pass | Private work repos are in the REST results |
| 4 | WhatBuilds org repos | Pass | 6 org repos found, 5 with commits |
| 6 | Pull requests | Pass | 79 opened, 79 merged, 0 open, all work |
| 7 | Commits by repo | Pass | Sums are consistent (see below) |
| 8 | UTC vs IST regrouping | Confirms IST is needed | 43 of 248 commits fall on a different day |
| 9 | Timing | Pass, over the 5 s guideline | 5.95 s total; caching is required |

Checks 3 and 4 also rely on `restrictedContributionsCount`: 0, and
`hasAnyRestrictedContributions`: false. No private contribution is hidden from
the details.

Check 5 (attribution) prints nothing in this output; see Manual verification.

## Check 1: daily commits against the GraphQL reference

Compared over 362 days; the partial first and last days of the UTC and IST
windows are excluded.

| Grouping | Mismatching days | Total abs diff |
| --- | --- | --- |
| UTC author date | 24 | 84 |
| UTC committer date | 27 | 94 |
| **IST author date** | **5** | **10** |
| IST committer date | 8 | 20 |

Totals: GraphQL 258, REST author date 248, REST committer date 248.

**Conclusion:** no grouping matches exactly. IST author date is closest, so the
app groups by `commit.author.date` in the selected timezone.

### Timezone of the reference

All 87 GraphQL `occurredAt` values have a time part other than `00:00:00Z`
(for example `2026-10-13T07:00:00Z`). They are not clean UTC-midnight days, so
the reference timezone is unclear. The script groups the reference by the
literal `YYYY-MM-DD` of `occurredAt`, with no conversion.

### IST author date mismatches

| Date | GraphQL | REST (IST) |
| --- | --- | --- |
| 2026-08-10 | 5 | 3 |
| 2026-08-17 | 12 | 7 |
| 2026-08-22 | 2 | 1 |
| 2026-09-02 | 5 | 4 |
| 2026-09-29 | 2 | 1 |

### UTC author date mismatches

15 of 24 shown by the script (9 more not listed).

| Date | GraphQL | REST (UTC) |
| --- | --- | --- |
| 2025-10-29 | 0 | 5 |
| 2025-10-30 | 5 | 0 |
| 2025-11-15 | 2 | 8 |
| 2025-11-16 | 6 | 0 |
| 2026-04-06 | 0 | 3 |
| 2026-04-07 | 4 | 14 |
| 2026-04-08 | 17 | 4 |
| 2026-04-09 | 0 | 3 |
| 2026-04-10 | 8 | 5 |
| 2026-06-12 | 6 | 8 |
| 2026-06-13 | 5 | 7 |
| 2026-06-14 | 4 | 0 |
| 2026-07-07 | 6 | 10 |
| 2026-07-08 | 10 | 6 |
| 2026-08-10 | 5 | 4 |

## Check 2: streaks

| Source | Grouping | Current | Longest |
| --- | --- | --- | --- |
| GraphQL reference (literal dates) | today = 2026-10-13 | 2 | 6 |
| GraphQL reference (literal dates) | today = 2026-10-14 (IST) | 2 | 6 |
| REST author date | UTC | 2 | 11 |
| REST author date | IST | 2 | 6 |
| REST committer date | UTC | 2 | 11 |
| REST committer date | IST | 2 | 6 |

The UTC longest streak (11) is wrong against the profile; IST (6) matches.

## Check 7: commits by repo (REST author date)

| REST | GraphQL | Repo | Kind |
| --- | --- | --- | --- |
| 82 | 87 | work-repo-a | work, private |
| 34 | 34 | work-repo-b | work, private |
| 28 | 31 | work-repo-c | work, private |
| 18 | 18 | LoveshPurswani18/hdpe-pipes-site | personal |
| 17 | 17 | LoveshPurswani18/Bristo-Cafe-Site | personal |
| 16 | 16 | LoveshPurswani18/whatbytes-ecommerce-site | personal |
| 11 | 11 | LoveshPurswani18/E-Commerce-platform | personal |
| 10 | 10 | work-repo-d | work, private |
| 8 | 8 | LoveshPurswani18/erino-task-glitch | personal |
| 6 | 6 | work-repo-e | work, private |
| 5 | 5 | LoveshPurswani18/GitTrack | personal |
| 4 | 5 | LoveshPurswani18/LoveshPurswani18 | personal |
| 3 | 3 | rsethi-codes/task-genie | personal |
| 3 | 3 | LoveshPurswani18/college-erp-frontend | personal |
| 2 | 2 | LoveshPurswani18/college-erp-backend | personal |
| 1 | 1 | LoveshPurswani18/Quiz-App | personal |
| 0 | 1 | work-repo-f | work, private |

Sum by repo 248, sum by UTC day 248, total 248: consistent. Work commits 160,
personal commits 88.

### Repos where GraphQL and REST differ (IST author date)

| Repo | REST | GraphQL | Differing IST days |
| --- | --- | --- | --- |
| work-repo-a | 82 | 87 | 3 (2026-08-10: 4 vs 2, 2026-08-17: 6 vs 4, 2026-09-29: 2 vs 1) |
| work-repo-c | 28 | 31 | 1 (2026-08-17: 6 vs 3) |
| LoveshPurswani18/LoveshPurswani18 | 4 | 5 | 1 (2026-09-02: 3 vs 2) |
| work-repo-f | 0 | 1 | 1 (2026-08-22: 1 vs 0, no REST commits that day) |

Where commits were listed, none had a co-author. On 2026-08-17 the committer
dates of several commits in `work-repo-a` are two days after their author dates,
which points to a rebase.

## Check 6: pull requests

| Measure | Total | Work | Personal |
| --- | --- | --- | --- |
| Opened in window | 79 | 79 | 0 |
| Merged in window (of those opened) | 79 | 79 | 0 |
| Open now | 0 | 0 | 0 |

To compare with GitHub PR search:

```
is:pr author:LoveshPurswani18 created:2025-10-14..2026-10-13
is:pr author:LoveshPurswani18 is:merged merged:2025-10-14..2026-10-13
```

Search also counts PRs in repos the user doesn't belong to, and merged PRs
opened before the window. The script does not.

## Check 8: UTC against IST

43 of 248 commits fall on a different day in UTC than in Asia/Kolkata. Examples
are commits at 22:33–23:43 UTC on 2026-04-07, which land on 2026-04-08 in IST.
This is why timezone-aware grouping is required.

## Check 9: timing

| Step | Time |
| --- | --- |
| GraphQL | 2.82 s |
| REST | 3.11 s |
| Total | 5.95 s |

Over the 5 s guideline. Lowest `x-ratelimit-remaining` seen: 4801.

## Daily counts

The full per-day table is 365 rows, mostly zeros, and is not kept here. Run
`spike/spike.mjs` to regenerate it. The 30-day sample used for the manual
profile comparison used seed 924927979; it had 2 non-zero days
(2025-10-20 and 2026-08-10).

## Warnings

None from the script.

## Manual verification

The script cannot prove checks 5 and 6 on its own. Both were verified by hand
on 13 Oct against the GitHub profile and PR search:

- **Check 5 (attribution):** recent work commits link to the profile.
- **Check 6 (pull requests):** the 79 opened and 79 merged PRs match GitHub PR
  search, using the two queries above.

With these, all 9 checks pass. The day-match figure is 357 of 362 compared days.
