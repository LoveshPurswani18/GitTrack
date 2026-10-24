import "server-only";

import { createHash } from "node:crypto";
import type { FixtureState } from "@/lib/config";
import type { Activity, Commit, PullRequest, Repo } from "@/types/activity";
import type { Profile } from "@/types/profile";
import activityRaw from "./fixtures/activity.json";
import activityEmptyRaw from "./fixtures/activity-empty.json";
import profileRaw from "./fixtures/profile.json";
import { GitHubError } from "./errors";

const DAY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_RESET_MS = 30 * 60 * 1000;

/** A moment stored as "N days ago at HH:MM in the given UTC offset". */
export type RelativeDate = { daysAgo: number; time: string };

/** `onDefault: false` marks commits that exist only on a feature branch (default: true). */
type RawCommit = { repo: string; daysAgo: number; time: string; count?: number; onDefault?: boolean };
type RawPullRequest = {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: PullRequest["state"];
  created: RelativeDate;
  merged: RelativeDate | null;
  closed: RelativeDate | null;
};
type RawActivity = {
  username: string;
  repos: Repo[];
  commits: RawCommit[];
  pullRequests: RawPullRequest[];
  restrictedCount: number;
  crossCheck: { date: string; count: number }[];
};
type RawProfile = Omit<Profile, "createdAt" | "fetchedAt"> & { createdAt: RelativeDate };

const TIME_PATTERN = /^(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/;

/**
 * Resolves a relative date to an ISO UTC string. The calendar day is taken in the
 * entry's own offset, so "daysAgo: 3, 01:00+05:30" is 01:00 IST three IST days ago,
 * which is the previous day in UTC. Results never lie after `now`.
 */
export function resolveRelativeDate({ daysAgo, time }: RelativeDate, now: Date): string {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new Error(`Invalid fixture time: ${time}`);
  const [, hh, mm, sign, oh, om] = match;
  const offsetMs = (sign === "-" ? -1 : 1) * (Number(oh) * 60 + Number(om)) * 60 * 1000;

  const local = new Date(now.getTime() + offsetMs);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const localMs = localMidnight - daysAgo * DAY_MS + (Number(hh) * 60 + Number(mm)) * 60 * 1000;
  return new Date(Math.min(localMs - offsetMs, now.getTime())).toISOString();
}

function fakeSha(repo: string, entry: number, index: number, authoredAt: string): string {
  return createHash("sha1").update(`${repo}:${authoredAt}:${entry}:${index}`).digest("hex");
}

function resolveActivity(raw: RawActivity, now: Date): Activity {
  const commits: Commit[] = [];
  raw.commits.forEach((entry, entryIndex) => {
    const authoredAt = resolveRelativeDate(entry, now);
    for (let i = 0; i < (entry.count ?? 1); i++) {
      commits.push({
        sha: fakeSha(entry.repo, entryIndex, i, authoredAt),
        repo: entry.repo,
        authoredAt,
        onDefault: entry.onDefault ?? true,
      });
    }
  });
  commits.sort((a, b) => a.authoredAt.localeCompare(b.authoredAt));

  const pullRequests: PullRequest[] = raw.pullRequests.map((pr) => ({
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    createdAt: resolveRelativeDate(pr.created, now),
    mergedAt: pr.merged ? resolveRelativeDate(pr.merged, now) : null,
    closedAt: pr.closed ? resolveRelativeDate(pr.closed, now) : null,
  }));

  return {
    username: raw.username,
    fetchedAt: now.toISOString(),
    windowStart: new Date(now.getTime() - 365 * DAY_MS).toISOString(),
    windowEnd: now.toISOString(),
    repos: raw.repos,
    commits,
    pullRequests,
    restrictedCount: raw.restrictedCount,
    crossCheck: raw.crossCheck,
    supersededCommits: [],
  };
}

function throwForState(state: FixtureState | null, now: Date) {
  if (state === "rate_limit") {
    throw new GitHubError("rate_limit", "GitHub rate limit reached (fixture)", {
      resetAt: new Date(now.getTime() + RATE_LIMIT_RESET_MS).toISOString(),
    });
  }
  if (state === "token_error") {
    throw new GitHubError("token", "GitHub token rejected (fixture)");
  }
}

export function loadFixtureActivity(state: FixtureState | null, now: Date): Activity {
  throwForState(state, now);
  const raw = state === "empty" ? activityEmptyRaw : activityRaw;
  return resolveActivity(raw as RawActivity, now);
}

export function loadFixtureProfile(state: FixtureState | null, now: Date): Profile {
  throwForState(state, now);
  const raw = profileRaw as RawProfile;
  return { ...raw, createdAt: resolveRelativeDate(raw.createdAt, now), fetchedAt: now.toISOString() };
}
