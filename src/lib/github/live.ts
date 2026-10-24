import "server-only";

import type { Activity, Commit, PullRequest, Repo } from "@/types/activity";
import type { Profile } from "@/types/profile";
import { MAX_PARALLEL_REQUESTS, type GitHubClient } from "./client";
import { GitHubError } from "./errors";
import {
  buildCrossCheck,
  canFetchCommits,
  mergeCommitSets,
  normalizeBranchHistories,
  normalizeCommits,
  normalizePullRequest,
  normalizePullRequestCommits,
  normalizePullRequestRestCommits,
  normalizeProfile,
  normalizeRepo,
  type PullRequestCommits,
  type RawBranchHistory,
  type RawContributionsCollection,
  type RawPullRequestPage,
  type RawPullRequestRestCommit,
  type RawRefs,
  type RawRepository,
  type RawRepositoryPage,
  type RawRestCommit,
  type RawUser,
} from "./normalize";

const DAY_MS = 24 * 60 * 60 * 1000;
/** GitHub caps contributionsCollection at one year; the spike proved 364 days works. */
export const WINDOW_DAYS = 364;
/** REST since/until filter on committer date, so the request is widened and author date decides. */
const PAD_DAYS = 3;
const MAX_PR_PAGES = 30;
/** 100 repositories per page; 2000 repos pushed within a year is far beyond a personal account. */
const MAX_REPOSITORY_PAGES = 20;
/** Repos per branch-history request. Each repo asks for up to 50 branches of 100 commits. */
const BRANCH_BATCH = 5;
const MAX_REF_PAGES = 20;

const REPOSITORY_FIELDS = `nameWithOwner url isFork isPrivate owner { login } defaultBranchRef { name }`;
// My commits in each PR (author login to drop other people's) and the merge commit, whose parent
// count tells a squash or rebase merge (one parent) from a true merge (two).
const PR_FIELDS = `number title url state createdAt mergedAt closedAt repository { ${REPOSITORY_FIELDS} }
  commits(first: 100) { totalCount nodes { commit { oid authoredDate author { user { login } } } } }
  mergeCommit { oid parents(first: 2) { totalCount } }`;

// maxRepositories is capped at 100 by GitHub; the spike's account had 17.
// contributions(first: 100) is not paginated: it only feeds the debug-only crossCheck.
const ACTIVITY_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    id
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

// Contributions only know the default branch, so repos whose work lives on branches are found
// from my recent pushes instead (newest first, so paging can stop at the window).
const REPOSITORIES_QUERY = `
query($login: String!, $after: String) {
  user(login: $login) {
    repositories(
      first: 100
      after: $after
      orderBy: { field: PUSHED_AT, direction: DESC }
      ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
    ) {
      pageInfo { hasNextPage endCursor }
      nodes { ${REPOSITORY_FIELDS} pushedAt }
    }
  }
}`;

/** One query for several repos (aliases r0, r1, ...): every branch with only my commits. */
function branchHistoriesQuery(repoCount: number): string {
  const variables = Array.from({ length: repoCount }, (_, i) => `$o${i}: String!, $n${i}: String!`).join(", ");
  const repos = Array.from(
    { length: repoCount },
    (_, i) => `r${i}: repository(owner: $o${i}, name: $n${i}) { ...BranchRefs }`,
  ).join("\n  ");
  return `
query($since: GitTimestamp!, $userId: ID!, $after: String, ${variables}) {
  ${repos}
}
fragment BranchRefs on Repository {
  refs(refPrefix: "refs/heads/", first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      name
      target {
        ... on Commit {
          history(first: 100, since: $since, author: { id: $userId }) {
            pageInfo { hasNextPage }
            nodes { oid authoredDate }
          }
        }
      }
    }
  }
}`;
}

type UserData<T> = { user: ({ contributionsCollection: T } & { id?: string }) | null };
type BranchData = Record<string, { refs: RawRefs } | null>;

export type LiveActivityInput = {
  username: string;
  workOrg: string;
  client: GitHubClient;
  now: Date;
};

type Window = { from: string; to: string };

/** Repos I can push to that were pushed within the window, newest first, until the window ends. */
async function discoverRepositories(
  client: GitHubClient,
  username: string,
  windowStart: Date,
): Promise<RawRepository[]> {
  const found: RawRepository[] = [];
  let after: string | null = null;
  for (let page = 0; ; page++) {
    if (page >= MAX_REPOSITORY_PAGES) {
      throw new GitHubError("network", "GitHub returned too many repository pages");
    }
    const data: { user: { repositories: RawRepositoryPage } | null } = await client.graphql(
      REPOSITORIES_QUERY,
      { login: username, after },
    );
    if (!data.user) throw new GitHubError("network", "GitHub user not found");
    const { nodes, pageInfo } = data.user.repositories;
    for (const node of nodes) {
      // A repo that was never pushed has no commits. Skip it rather than stop: where GitHub
      // sorts null push times is not documented, and stopping here could drop every later repo.
      if (!node.pushedAt) continue;
      // Sorted by push time: the first repo pushed before the window ends the search.
      if (Date.parse(node.pushedAt) < windowStart.getTime()) return found;
      found.push(node);
    }
    if (!pageInfo.hasNextPage) return found;
    after = pageInfo.endCursor;
  }
}

function splitName(nameWithOwner: string): [string, string] {
  const slash = nameWithOwner.indexOf("/");
  return [nameWithOwner.slice(0, slash), nameWithOwner.slice(slash + 1)];
}

/** Every branch of each repo with only my commits: one request per BRANCH_BATCH repos. */
async function fetchBranchHistories(
  client: GitHubClient,
  repos: RawRepository[],
  userId: string,
  since: string,
): Promise<Map<string, RawBranchHistory[]>> {
  const result = new Map<string, RawBranchHistory[]>();
  const batches: RawRepository[][] = [];
  for (let i = 0; i < repos.length; i += BRANCH_BATCH) batches.push(repos.slice(i, i + BRANCH_BATCH));

  await client.pool(batches, MAX_PARALLEL_REQUESTS, async (batch) => {
    const variables: Record<string, unknown> = { since, userId, after: null };
    batch.forEach((repo, i) => {
      [variables[`o${i}`], variables[`n${i}`]] = splitName(repo.nameWithOwner);
    });
    const data = await client.graphql<BranchData>(branchHistoriesQuery(batch.length), variables);

    for (const [i, repo] of batch.entries()) {
      const first = data[`r${i}`];
      if (!first) throw new GitHubError("network", `GitHub repository not found: ${repo.nameWithOwner}`);
      const branches = [...first.refs.nodes];
      let page = first.refs.pageInfo;
      // A repo with more than 50 branches: keep paging this repo alone.
      for (let n = 0; page.hasNextPage; n++) {
        if (n >= MAX_REF_PAGES) throw new GitHubError("network", "GitHub returned too many branch pages");
        const [owner, name] = splitName(repo.nameWithOwner);
        const next = await client.graphql<BranchData>(branchHistoriesQuery(1), {
          since,
          userId,
          after: page.endCursor,
          o0: owner,
          n0: name,
        });
        if (!next.r0) throw new GitHubError("network", `GitHub repository not found: ${repo.nameWithOwner}`);
        branches.push(...next.r0.refs.nodes);
        page = next.r0.refs.pageInfo;
      }
      result.set(repo.nameWithOwner, branches);
    }
  });
  return result;
}

export async function fetchLiveActivity(input: LiveActivityInput): Promise<Activity> {
  const { username, workOrg, client, now } = input;
  const from = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const window: Window = { from: from.toISOString(), to: now.toISOString() };
  const variables = { login: username, from: window.from, to: window.to };

  // 1) GraphQL: my id, repos with my default-branch commits, my PRs (with their commits).
  const first = await client.graphql<UserData<RawContributionsCollection>>(ACTIVITY_QUERY, variables);
  if (!first.user) throw new GitHubError("network", "GitHub user not found");
  const userId = first.user.id;
  if (!userId) throw new GitHubError("network", "GitHub returned no user id");
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

  // 2) Repos I can push to, found by recent pushes: their work may live only on branches.
  const discovered = await discoverRepositories(client, username, from);

  // 3) Repos: contribution repos, PR repos, then discovered ones. Metrics drop records whose repo
  //    is not in `repos`, so PR-only repos must be listed. Only contribution and discovered
  //    repos are scanned for commits: PR-only repos are ones I do not belong to.
  const repos = new Map<string, Repo>();
  const scan = new Map<string, RawRepository>();
  const addRepo = (raw: RawRepository, scanned: boolean) => {
    if (!repos.has(raw.nameWithOwner)) repos.set(raw.nameWithOwner, normalizeRepo(raw, workOrg));
    if (scanned && canFetchCommits(raw) && !scan.has(raw.nameWithOwner)) scan.set(raw.nameWithOwner, raw);
  };
  for (const entry of collection.commitContributionsByRepository) addRepo(entry.repository, true);
  for (const { pullRequest } of prNodes) addRepo(pullRequest.repository, false);
  for (const raw of discovered) addRepo(raw, true);

  // 4) Commits by me on every branch of the scanned repos.
  const since = new Date(from.getTime() - PAD_DAYS * DAY_MS).toISOString();
  const until = new Date(now.getTime() + PAD_DAYS * DAY_MS).toISOString();
  const scanned = [...scan.values()];
  const histories = await fetchBranchHistories(client, scanned, userId, since);

  const branchCommits: Commit[] = [];
  const overflow: { repo: RawRepository; branch: string }[] = [];
  for (const repo of scanned) {
    const result = normalizeBranchHistories(
      histories.get(repo.nameWithOwner) ?? [],
      repo.nameWithOwner,
      repo.defaultBranchRef!.name,
      window,
    );
    branchCommits.push(...result.commits);
    overflow.push(...result.overflow.map((branch) => ({ repo, branch })));
  }

  // A branch with more than 100 of my commits in the window is read completely through REST.
  const fromOverflow = await client.pool(overflow, MAX_PARALLEL_REQUESTS, async ({ repo, branch }) => {
    const params = new URLSearchParams({
      author: username,
      sha: branch,
      since,
      until,
      per_page: "100",
    });
    const raw = await client.restPages<RawRestCommit>(`/repos/${repo.nameWithOwner}/commits?${params}`);
    return normalizeCommits(raw, repo.nameWithOwner, window, branch === repo.defaultBranchRef!.name);
  });

  // 5) My commits inside my PRs: they survive a deleted branch and a squash or rebase merge.
  const pullRequestCommits: PullRequestCommits[] = await client.pool(
    prNodes.filter(({ pullRequest }) => scan.has(pullRequest.repository.nameWithOwner)),
    MAX_PARALLEL_REQUESTS,
    async ({ pullRequest }) => {
      const result = normalizePullRequestCommits(pullRequest, username, window);
      if (result.complete) return result;
      const raw = await client.restPages<RawPullRequestRestCommit>(
        `/repos/${pullRequest.repository.nameWithOwner}/pulls/${pullRequest.number}/commits?per_page=100`,
      );
      const commits = normalizePullRequestRestCommits(raw, result.repo, username, window);
      return { ...result, commits, complete: true };
    },
  );

  const { commits, superseded } = mergeCommitSets({
    commits: [...branchCommits, ...fromOverflow.flat()],
    pullRequests: pullRequestCommits,
  });

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
    supersededCommits: superseded,
  };
}

export async function fetchLiveProfile(input: {
  username: string;
  client: GitHubClient;
  now: Date;
}): Promise<Profile> {
  const raw = await input.client.rest<RawUser>(`/users/${encodeURIComponent(input.username)}`);
  return normalizeProfile(raw, input.now);
}
