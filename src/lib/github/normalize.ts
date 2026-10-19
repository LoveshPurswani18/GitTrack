import "server-only";

import type { Commit, PullRequest, Repo } from "@/types/activity";
import type { Profile } from "@/types/profile";

// Raw shapes: only the fields the queries in live.ts ask for.

export type RawRepository = {
  nameWithOwner: string;
  url: string;
  isFork: boolean;
  isPrivate: boolean;
  owner: { login: string };
  defaultBranchRef: { name: string } | null;
};

export type RawCommitContributionsByRepository = {
  repository: RawRepository;
  contributions: { nodes: { occurredAt: string; commitCount: number }[] };
};

export type RawPullRequest = {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  repository: RawRepository;
};

export type RawPullRequestPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: { pullRequest: RawPullRequest }[];
};

export type RawContributionsCollection = {
  restrictedContributionsCount: number;
  commitContributionsByRepository: RawCommitContributionsByRepository[];
  pullRequestContributions: RawPullRequestPage;
};

/** A commit from the REST list endpoint. Only the sha and author date are read. */
export type RawRestCommit = {
  sha: string;
  commit: { author: { date: string } | null };
};

export type RawUser = {
  avatar_url: string;
  name: string | null;
  login: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
  html_url: string;
};

export function isWorkOwner(owner: string, workOrg: string): boolean {
  return owner.toLowerCase() === workOrg.toLowerCase();
}

export function normalizeRepo(raw: RawRepository, workOrg: string): Repo {
  return {
    nameWithOwner: raw.nameWithOwner,
    url: raw.url,
    isPrivate: raw.isPrivate,
    isWork: isWorkOwner(raw.owner.login, workOrg),
    defaultBranch: raw.defaultBranchRef?.name ?? "",
  };
}

/** Commits on a fork or on a repo without a default branch are not fetched. */
export function canFetchCommits(raw: RawRepository): boolean {
  return !raw.isFork && raw.defaultBranchRef !== null;
}

const PR_STATES: Record<RawPullRequest["state"], PullRequest["state"]> = {
  OPEN: "open",
  MERGED: "merged",
  CLOSED: "closed", // closed without merging
};

export function normalizePullRequest(raw: RawPullRequest): PullRequest {
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    state: PR_STATES[raw.state],
    createdAt: raw.createdAt,
    mergedAt: raw.mergedAt,
    closedAt: raw.closedAt,
  };
}

/**
 * Keeps commits whose author date is inside the window, once per sha. The REST `since` and
 * `until` filter on committer date, so the request is widened and this is the real filter.
 * Commit messages are never read.
 */
export function normalizeCommits(
  raw: RawRestCommit[],
  repo: string,
  window: { from: string; to: string },
): Commit[] {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const seen = new Set<string>();
  const commits: Commit[] = [];
  for (const entry of raw) {
    const date = entry.commit.author?.date;
    if (!date || seen.has(entry.sha)) continue;
    const time = Date.parse(date);
    if (Number.isNaN(time) || time < from || time > to) continue;
    seen.add(entry.sha);
    commits.push({ sha: entry.sha, repo, authoredAt: new Date(time).toISOString() });
  }
  return commits;
}

/** GitHub's own per-day commit counts (debug only), summed over repos, by the date as reported. */
export function buildCrossCheck(
  entries: RawCommitContributionsByRepository[],
): { date: string; count: number }[] {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    for (const node of entry.contributions.nodes) {
      const date = node.occurredAt.slice(0, 10);
      byDay.set(date, (byDay.get(date) ?? 0) + node.commitCount);
    }
  }
  return [...byDay]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeProfile(raw: RawUser): Profile {
  return {
    avatarUrl: raw.avatar_url,
    name: raw.name,
    login: raw.login,
    bio: raw.bio,
    location: raw.location,
    company: raw.company,
    followers: raw.followers,
    following: raw.following,
    publicRepos: raw.public_repos,
    createdAt: raw.created_at,
    url: raw.html_url,
  };
}
