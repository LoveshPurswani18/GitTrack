import "server-only";

import type { Activity, Commit, PullRequest, Repo } from "@/types/activity";
import type { Profile } from "@/types/profile";
import { MAX_PARALLEL_REQUESTS, type GitHubClient } from "./client";
import { GitHubError } from "./errors";
import {
  buildCrossCheck,
  canFetchCommits,
  normalizeCommits,
  normalizePullRequest,
  normalizeProfile,
  normalizeRepo,
  type RawContributionsCollection,
  type RawPullRequestPage,
  type RawRepository,
  type RawRestCommit,
  type RawUser,
} from "./normalize";

const DAY_MS = 24 * 60 * 60 * 1000;
/** GitHub caps contributionsCollection at one year; the spike proved 364 days works. */
export const WINDOW_DAYS = 364;
/** REST since/until filter on committer date, so the request is widened and author date decides. */
const PAD_DAYS = 3;
const MAX_PR_PAGES = 30;

const REPOSITORY_FIELDS = `nameWithOwner url isFork isPrivate owner { login } defaultBranchRef { name }`;
const PR_FIELDS = `number title url state createdAt mergedAt closedAt repository { ${REPOSITORY_FIELDS} }`;

// maxRepositories is capped at 100 by GitHub; the spike's account had 17.
// contributions(first: 100) is not paginated: it only feeds the debug-only crossCheck.
const ACTIVITY_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      restrictedContributionsCount
      commitContributionsByRepository(maxRepositories: 100) {
        repository { ${REPOSITORY_FIELDS} }
        contributions(first: 100) { nodes { occurredAt commitCount } }
      }
      pullRequestContributions(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes { pullRequest { ${PR_FIELDS} } }
      }
    }
  }
}`;

const PR_PAGE_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!, $after: String!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      pullRequestContributions(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { pullRequest { ${PR_FIELDS} } }
      }
    }
  }
}`;

type UserData<T> = { user: { contributionsCollection: T } | null };

export type LiveActivityInput = {
  username: string;
  workOrg: string;
  client: GitHubClient;
  now: Date;
};

export async function fetchLiveActivity(input: LiveActivityInput): Promise<Activity> {
  const { username, workOrg, client, now } = input;
  const from = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const window = { from: from.toISOString(), to: now.toISOString() };
  const variables = { login: username, from: window.from, to: window.to };

  // 1) GraphQL: repos with my commits, my PRs, restricted count.
  const first = await client.graphql<UserData<RawContributionsCollection>>(ACTIVITY_QUERY, variables);
  if (!first.user) throw new GitHubError("network", "GitHub user not found");
  const collection = first.user.contributionsCollection;

  const prNodes = [...collection.pullRequestContributions.nodes];
  let page: RawPullRequestPage["pageInfo"] = collection.pullRequestContributions.pageInfo;
  for (let n = 0; page.hasNextPage; n++) {
    if (n >= MAX_PR_PAGES) throw new GitHubError("network", "GitHub returned too many pull request pages");
    const next = await client.graphql<UserData<Pick<RawContributionsCollection, "pullRequestContributions">>>(
      PR_PAGE_QUERY,
      { ...variables, after: page.endCursor },
    );
    if (!next.user) throw new GitHubError("network", "GitHub user not found");
    prNodes.push(...next.user.contributionsCollection.pullRequestContributions.nodes);
    page = next.user.contributionsCollection.pullRequestContributions.pageInfo;
  }

  // 2) Repos: those with my commits, plus the repos of my PRs. Metrics drop records whose
  //    repo is not in `repos`, so PR-only repos must be listed (they get no commit fetch).
  const repos = new Map<string, Repo>();
  const addRepo = (raw: RawRepository) => {
    if (!repos.has(raw.nameWithOwner)) repos.set(raw.nameWithOwner, normalizeRepo(raw, workOrg));
  };
  for (const entry of collection.commitContributionsByRepository) addRepo(entry.repository);
  for (const { pullRequest } of prNodes) addRepo(pullRequest.repository);

  // 3) REST: commits per repo on the default branch, by me.
  const since = new Date(from.getTime() - PAD_DAYS * DAY_MS).toISOString();
  const until = new Date(now.getTime() + PAD_DAYS * DAY_MS).toISOString();
  const fetchable = collection.commitContributionsByRepository
    .map((entry) => entry.repository)
    .filter(canFetchCommits);

  const perRepo = await client.pool(fetchable, MAX_PARALLEL_REQUESTS, async (repo) => {
    const params = new URLSearchParams({
      author: username,
      sha: repo.defaultBranchRef!.name,
      since,
      until,
      per_page: "100",
    });
    const raw = await client.restPages<RawRestCommit>(`/repos/${repo.nameWithOwner}/commits?${params}`);
    return normalizeCommits(raw, repo.nameWithOwner, window);
  });
  const commits: Commit[] = perRepo.flat().sort((a, b) => a.authoredAt.localeCompare(b.authoredAt));

  const pullRequests: PullRequest[] = prNodes
    .map((node) => normalizePullRequest(node.pullRequest))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    username,
    fetchedAt: window.to,
    windowStart: window.from,
    windowEnd: window.to,
    repos: [...repos.values()],
    commits,
    pullRequests,
    restrictedCount: collection.restrictedContributionsCount,
    crossCheck: buildCrossCheck(collection.commitContributionsByRepository),
  };
}

export async function fetchLiveProfile(input: { username: string; client: GitHubClient }): Promise<Profile> {
  const raw = await input.client.rest<RawUser>(`/users/${encodeURIComponent(input.username)}`);
  return normalizeProfile(raw);
}
