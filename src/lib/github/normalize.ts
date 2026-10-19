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

/** A commit inside a pull request, as GraphQL returns it. Only what the merge step needs. */
export type RawPullRequestCommit = {
  commit: {
    oid: string;
    authoredDate: string;
    author: { user: { login: string } | null } | null;
  };
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
  /** First 100 commits; `totalCount` larger than `nodes.length` means the list is cut short. */
  commits: { totalCount: number; nodes: RawPullRequestCommit[] };
  /** The commit created on the base branch by the merge, when the PR was merged. */
  mergeCommit: { oid: string; parents: { totalCount: number } } | null;
};

/** One page of the repositories I can push to, newest push first. */
export type RawRepositoryPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: (RawRepository & { pushedAt: string | null })[];
};

/** A branch with my commits in the window (GraphQL `history` filtered to my author). */
export type RawBranchHistory = {
  name: string;
  /** Empty when the ref does not point at a commit. */
  target: {
    history?: {
      pageInfo: { hasNextPage: boolean };
      nodes: { oid: string; authoredDate: string }[];
    };
  } | null;
};

export type RawRefs = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: RawBranchHistory[];
};

/** A commit from `GET /repos/{r}/pulls/{n}/commits`: the list one carries the author login. */
export type RawPullRequestRestCommit = RawRestCommit & { author: { login: string } | null };

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

type Window = { from: string; to: string };

/** The author time as an ISO string if it falls inside the window (edges included), else null. */
function inWindow(date: string | null | undefined, window: Window): string | null {
  if (!date) return null;
  const time = Date.parse(date);
  if (Number.isNaN(time) || time < Date.parse(window.from) || time > Date.parse(window.to)) {
    return null;
  }
  return new Date(time).toISOString();
}

/**
 * Keeps commits whose author date is inside the window, once per sha. The REST `since` and
 * `until` filter on committer date, so the request is widened and this is the real filter.
 * `onDefault` says whether the list came from the default branch. Commit messages are never read.
 */
export function normalizeCommits(
  raw: RawRestCommit[],
  repo: string,
  window: Window,
  onDefault: boolean,
): Commit[] {
  const seen = new Set<string>();
  const commits: Commit[] = [];
  for (const entry of raw) {
    const authoredAt = inWindow(entry.commit.author?.date, window);
    if (!authoredAt || seen.has(entry.sha)) continue;
    seen.add(entry.sha);
    commits.push({ sha: entry.sha, repo, authoredAt, onDefault });
  }
  return commits;
}

/**
 * Every branch's commits by me in one repo, once per sha. A commit on several branches is
 * `onDefault` when one of them is the default branch. `overflow` lists branches whose history
 * was cut at 100 commits; those are fetched completely with REST.
 */
export function normalizeBranchHistories(
  branches: RawBranchHistory[],
  repo: string,
  defaultBranch: string,
  window: Window,
): { commits: Commit[]; overflow: string[] } {
  const bySha = new Map<string, Commit>();
  const overflow: string[] = [];
  for (const branch of branches) {
    const history = branch.target?.history;
    if (!history) continue;
    const onDefault = branch.name === defaultBranch;
    if (history.pageInfo.hasNextPage) overflow.push(branch.name);
    for (const node of history.nodes) {
      const authoredAt = inWindow(node.authoredDate, window);
      if (!authoredAt) continue;
      const existing = bySha.get(node.oid);
      if (existing) existing.onDefault ||= onDefault;
      else bySha.set(node.oid, { sha: node.oid, repo, authoredAt, onDefault });
    }
  }
  return { commits: [...bySha.values()], overflow };
}

/** What one pull request contributes to the commit list. */
export type PullRequestCommits = {
  repo: string;
  /** My commits in the PR (never `onDefault`; the merge step flags shared ones). */
  commits: Commit[];
  /** The merge commit's sha, when the PR was merged. */
  mergeCommitSha: string | null;
  /** The merge commit has one parent: a squash or rebase merge that rewrote the commits. */
  rewritten: boolean;
  /** False when GraphQL returned fewer commits than the PR has; use `normalizePullRequestRestCommits`. */
  complete: boolean;
};

const sameLogin = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

/** My commits in a PR, filtered by author login (a PR can include other people's commits). */
export function normalizePullRequestCommits(
  raw: RawPullRequest,
  username: string,
  window: Window,
): PullRequestCommits {
  const repo = raw.repository.nameWithOwner;
  const seen = new Set<string>();
  const commits: Commit[] = [];
  for (const { commit } of raw.commits.nodes) {
    if (!sameLogin(commit.author?.user?.login, username) || seen.has(commit.oid)) continue;
    const authoredAt = inWindow(commit.authoredDate, window);
    if (!authoredAt) continue;
    seen.add(commit.oid);
    commits.push({ sha: commit.oid, repo, authoredAt, onDefault: false });
  }
  return {
    repo,
    commits,
    mergeCommitSha: raw.mergeCommit?.oid ?? null,
    rewritten: raw.mergeCommit !== null && raw.mergeCommit.parents.totalCount === 1,
    complete: raw.commits.nodes.length >= raw.commits.totalCount,
  };
}

/** The REST version, for PRs with more commits than GraphQL returned. */
export function normalizePullRequestRestCommits(
  raw: RawPullRequestRestCommit[],
  repo: string,
  username: string,
  window: Window,
): Commit[] {
  return normalizeCommits(
    raw.filter((entry) => sameLogin(entry.author?.login, username)),
    repo,
    window,
    false,
  );
}

const byTimeThenSha = (a: Commit, b: Commit) =>
  a.authoredAt.localeCompare(b.authoredAt) || a.sha.localeCompare(b.sha);

/**
 * Combines branch commits and PR commits into one list.
 *
 * - One commit per sha; `onDefault` if any copy was on the default branch.
 * - A squash or rebase merge puts new commits on the default branch (the squash commit is
 *   dated at merge time; a rebase keeps author dates but changes the shas). Counting them
 *   too would double the work and move it to the merge day, so they are dropped when the PR's
 *   own commits are present, and kept in `superseded` so the default-branch part still
 *   matches what GitHub counts:
 *     - the PR's merge commit (squash, or the last commit of a rebase);
 *     - a default-branch commit with the same repo and author time as one of the PR's commits
 *       (the rest of a rebase).
 * - A true merge keeps the original shas, so nothing is dropped.
 */
export function mergeCommitSets(input: {
  commits: Commit[];
  pullRequests: PullRequestCommits[];
}): { commits: Commit[]; superseded: Commit[] } {
  const bySha = new Map<string, Commit>();
  const add = (commit: Commit) => {
    const existing = bySha.get(commit.sha);
    if (existing) existing.onDefault ||= commit.onDefault;
    else bySha.set(commit.sha, { ...commit });
  };
  input.commits.forEach(add);
  input.pullRequests.forEach((pr) => pr.commits.forEach(add));

  const superseded = new Map<string, Commit>();
  const supersede = (sha: string) => {
    const commit = bySha.get(sha);
    if (!commit) return;
    superseded.set(sha, commit);
    bySha.delete(sha);
  };

  // A sha that is one of a PR's own commits is never dropped, so collect them all first.
  const prShas = new Set(input.pullRequests.flatMap((pr) => pr.commits.map((c) => c.sha)));
  const rewrittenTimes = new Set<string>(); // `${repo}|${authoredAt}` of PR commits after a rewrite
  for (const pr of input.pullRequests) {
    if (!pr.rewritten || pr.commits.length === 0) continue;
    for (const commit of pr.commits) rewrittenTimes.add(`${commit.repo}|${commit.authoredAt}`);
    const merge = pr.mergeCommitSha ? bySha.get(pr.mergeCommitSha) : undefined;
    if (merge?.onDefault && !prShas.has(merge.sha)) supersede(merge.sha);
  }
  for (const commit of [...bySha.values()]) {
    const isRebaseCopy =
      commit.onDefault && !prShas.has(commit.sha) && rewrittenTimes.has(`${commit.repo}|${commit.authoredAt}`);
    if (isRebaseCopy) supersede(commit.sha);
  }

  return {
    commits: [...bySha.values()].sort(byTimeThenSha),
    superseded: [...superseded.values()].sort(byTimeThenSha),
  };
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
