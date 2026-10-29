# Phase 0 validation spike

Throwaway script that checks whether the GitHub API can give exact, timezone-aware
commit and PR data (PRD "Phase 0"). Only the findings carry over: record them in
`spike/RESULTS.md`.

It reads real WhatBuilds data, so only the repo owner runs it. No dependencies.

## Setup

1. Node 20.6 or newer (`node -v`).
2. A dedicated classic PAT with `repo` and `read:org`, SSO-authorized for WhatBuilds.
3. Add to `.env.local` (this file is git-ignored):

   ```
   GITHUB_TOKEN=...
   GITHUB_USERNAME=...
   WORK_ORG=...
   ```

   Leave `GITHUB_DATA=fixtures` as is; the spike ignores it.

## Run

From the repo root:

```
node --env-file=.env.local spike/spike.mjs
node --env-file=.env.local spike/spike.mjs --sample 30          # 30 random days, zeros included
node --env-file=.env.local spike/spike.mjs --sample 30 --seed 7  # reproducible sample
node --env-file=.env.local spike/spike.mjs --full                # every day in the window
node spike/spike.mjs --selftest                                  # helper tests, no network
```

The window is the last 364 days, ending now (UTC).

## Saving the results

The raw output contains real work repo names, so it never goes into a tracked file.

1. Save the raw output to `temp/` (git-ignored) while still seeing it on screen:

   ```
   mkdir -p temp
   node --env-file=.env.local spike/spike.mjs --sample 30 --seed 7 2>&1 | tee temp/spike-output.txt
   ```

   Add `--full` if you also want the per-day table. Use a fixed `--seed` so the
   sample days can be re-checked against the profile later.

2. Write the findings by hand in `spike/RESULTS.md` (tracked, so no repo names, PR
   titles or commit messages). Use the numbers and verdict lines from the saved
   output. Suggested format:

   ```
   # Phase 0 spike results

   Run: YYYY-MM-DD, window 364 days, seed 7, total fetch time X.Xs

   | # | Check | Result | Notes |
   | --- | --- | --- | --- |
   | 1 | Daily commit counts | pass/fail | e.g. author.date matches, 0 mismatching days |
   | 2 | Streaks | pass/fail | current N, longest N vs profile |
   | 3 | Private repos | pass/fail | |
   | 4 | WhatBuilds org repos | pass/fail | SSO authorized? |
   | 5 | Attribution | pass/fail | |
   | 6 | PRs | pass/fail | opened N, merged N vs PR search |
   | 7 | Per-project counts | pass/fail | sum by repo equals total |
   | 8 | Timezone regrouping | pass/fail | N commits shift day in IST |
   | 9 | Speed | pass/fail | total X.Xs |

   Decision: go / no-go. If no-go, which check failed and why.
   ```

3. Check that `RESULTS.md` has no repo names before committing it. `temp/` stays local.

## Reading the output

| Section | PRD check | Pass looks like |
| --- | --- | --- |
| Run, Restricted contributions | 3, 4 | Work repos appear in the list; check the restricted count against your profile settings |
| occurredAt inspection | 1 | All values `T00:00:00Z`, so the reference is UTC days |
| Check 1 | 1, 5 | Compares four groupings (UTC and IST × author.date and committer.date) against the GraphQL reference. Pass: 0 mismatching days for at least one grouping; the verdict names which match, or the closest |
| Check 7b | 5, 7 | Lists repos where GraphQL and REST totals differ, with the differing IST days and, for REST commits on those days, short sha, author.date, committer.date and whether the message has `Co-authored-by`. Pass: empty, or every difference explained |
| `--sample 30` | 1 | The graphql and utc columns match your profile graph on those days |
| Check 2 | 2 | Current and longest streak equal your manual count from the profile. Printed for the GraphQL reference (with today in UTC and in IST) and for each REST grouping |
| Check 7 | 7 | Per-repo sum equals the total; work repos carry `[WORK]` |
| Check 6 | 6 | Opened and merged counts equal the two printed search strings in GitHub PR search |
| Check 8 | 8 | A late-night commit shows a different day in UTC vs IST |
| Check 9 | 9 | Total fetch time within a few seconds (guideline: 5s) |
| Warnings | 3, 4 | Empty, or only expected items; a 403 on a work repo means SSO is not authorized |

## Caveats

- PRs opened before the 364-day window are not counted, even if merged inside it, and
  PRs in repos you don't belong to are excluded. GitHub PR search includes both, so small
  differences at the edges are expected; check the search window first.
- GraphQL `occurredAt` is day-granular, so the reference exists in one timezone only
  (the script reports which). It is always compared by its literal date, so the IST rows
  in check 1 test whether GitHub's days follow IST, not UTC. The partial first and last
  days of both the UTC and IST windows are excluded from the comparison.
- Check 7b compares per-repo GraphQL days with REST days grouped in IST by author.date,
  lists at most 15 differing days per repo, and ignores repos whose totals agree.
- Check 7b output contains repo names, like the rest of the output; the script and this
  README contain none.
- Fork commits are skipped, per the PRD.
- The output contains real work repo names. Do not paste it into chat, commits or docs;
  report pass/fail per check only.
