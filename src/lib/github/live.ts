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
/** Repos per branch-list request (aliases). Each repo lists up to 100 branches: names and tip dates only. */
const BRANCH_BATCH = 5;
const BRANCH_LIST_PAGE_SIZE = 100;
/** 5,000 branches in one repo; past this the list is cut (and logged) rather than failing the load. */
const MAX_BRANCH_LIST_PAGES = 50;
/** Active branches per history request. Each asks for up to 100 of my commits. */
const HISTORY_BRANCHES_PER_REQUEST = 25;

const REPOSITORY_FIELDS = `nameWithOwner url isFork isPrivate owner { login } defaultBranchRef { name }`;
// My commits in each PR (author login to drop other people's) and the merge commit, whose parent
// count tells a squash or rebase merge (one parent) from a true merge (two).
const PR_FIELDS = `number title url state createdAt mergedAt closedAt repository { ${REPOSITORY_FIELDS} }
  commits(first: 100) { totalCount nodes { commit { oid authoredDate author { user { login } } } } }
  mergeCommit { oid parents(first: 2) { totalCount } }`;

// maxRepositories is capped at 100 by GitHub; the spike's account had 17.
// contributions(first: 100) is not paginated: it only feeds the debug-only crossCheck.
const ACTIVITY_QUERY = `
query Activity($login: String!, $from: DateTime!, $to: DateTime!) {
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
query PullRequestPage($login: String!, $from: DateTime!, $to: DateTime!, $after: String!) {
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
query Repositories($login: String!, $after: String) {
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

/** Step A, light: for several repos (aliases r0, r1, ...) every branch's name and tip date, no history. */
function branchListQuery(repoCount: number): string {
  const variables = Array.from({ length: repoCount }, (_, i) => `$o${i}: String!, $n${i}: String!`).join(", ");
  const repos = Array.from(
    { length: repoCount },
    (_, i) => `r${i}: repository(owner: $o${i}, name: $n${i}) { ...BranchTips }`,
  ).join("\n  ");
  return `
query BranchList($after: String, ${variables}) {
  ${repos}
}
fragment BranchTips on Repository {
  refs(refPrefix: "refs/heads/", first: ${BRANCH_LIST_PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      name
      target { ... on Commit { committedDate } }
    }
  }
}`;
}

/** Step B: one repo, several named branches (aliases b0, b1, ...), only my commits on each. */
function branchHistoriesQuery(branchCount: number): string {
  const variables = Array.from({ length: branchCount }, (_, i) => `$q${i}: String!`).join(", ");
  const branches = Array.from(
    { length: branchCount },
    (_, i) => `b${i}: ref(qualifiedName: $q${i}) { ...BranchHistory }`,
  ).join("\n    ");
  return `
query BranchHistories($o: String!, $n: String!, $since: GitTimestamp!, $userId: ID!, ${variables}) {
  repository(owner: $o, name: $n) {
    ${branches}
  }
}
fragment BranchHistory on Ref {
  target {
    ... on Commit {
      history(first: 100, since: $since, author: { id: $userId }) {
        pageInfo { hasNextPage }
        nodes { oid authoredDate }
      }
    }
  }
}`;
}

type UserData<T> = { user: ({ contributionsCollection: T } & { id?: string }) | null };
type BranchData = Record<string, { refs: RawRefs } | null>;
type HistoryData = { repository: Record<string, { target: RawBranchHistory["target"] } | null> | null };

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

/**
 * Step A: the branches of each repo whose tip commit is inside the window. A branch whose tip is
 * older than `since` cannot hold a commit since `since`, so only these need their history read.
 * GitHub gives no useful order for branches, so every branch is listed, 100 per light request.
 */
async function listActiveBranches(
  client: GitHubClient,
  repos: RawRepository[],
  since: string,
): Promise<Map<string, string[]>> {
  const active = new Map<string, string[]>();
  const windowStart = Date.parse(since);
  const batches: RawRepository[][] = [];
  for (let i = 0; i < repos.length; i += BRANCH_BATCH) batches.push(repos.slice(i, i + BRANCH_BATCH));

  const keepActive = (nodes: RawBranchHistory[]) =>
    nodes
      .filter((node) => node.target?.committedDate && Date.parse(node.target.committedDate) >= windowStart)
      .map((node) => node.name);

  await client.pool(batches, MAX_PARALLEL_REQUESTS, async (batch) => {
    const variables: Record<string, unknown> = { after: null };
    batch.forEach((repo, i) => {
      [variables[`o${i}`], variables[`n${i}`]] = splitName(repo.nameWithOwner);
    });
    const data = await client.graphql<BranchData>(branchListQuery(batch.length), variables);

    for (const [i, repo] of batch.entries()) {
      const first = data[`r${i}`];
      if (!first) throw new GitHubError("network", `GitHub repository not found: ${repo.nameWithOwner}`);
      const names = keepActive(first.refs.nodes);
      let listed = first.refs.nodes.length;
      let page = first.refs.pageInfo;
      // A repo with more than 100 branches: keep listing this repo alone.
      for (let n = 1; page.hasNextPage; n++) {
        if (n >= MAX_BRANCH_LIST_PAGES) {
          client.log(`[github] branch list cut at ${listed} branches of :repo`);
          break;
        }
        const [owner, name] = splitName(repo.nameWithOwner);
        const next = await client.graphql<BranchData>(branchListQuery(1), {
          after: page.endCursor,
          o0: owner,
          n0: name,
        });
        if (!next.r0) throw new GitHubError("network", `GitHub repository not found: ${repo.nameWithOwner}`);
        names.push(...keepActive(next.r0.refs.nodes));
        listed += next.r0.refs.nodes.length;
        page = next.r0.refs.pageInfo;
      }
      active.set(repo.nameWithOwner, names);
    }
  });
  return active;
}

/** Step B: my commits on each active branch, in chunks of HISTORY_BRANCHES_PER_REQUEST per request. */
async function fetchBranchHistories(
  client: GitHubClient,
  repos: RawRepository[],
  userId: string,
  since: string,
): Promise<Map<string, RawBranchHistory[]>> {
  const active = await listActiveBranches(client, repos, since);

  const chunks: { repo: string; names: string[] }[] = [];
  for (const [repo, names] of active) {
    for (let i = 0; i < names.length; i += HISTORY_BRANCHES_PER_REQUEST) {
      chunks.push({ repo, names: names.slice(i, i + HISTORY_BRANCHES_PER_REQUEST) });
    }
  }

  const fetched = await client.pool(chunks, MAX_PARALLEL_REQUESTS, async ({ repo, names }) => {
    const [owner, name] = splitName(repo);
    const variables: Record<string, unknown> = { o: owner, n: name, since, userId };
    names.forEach((branch, i) => {
      variables[`q${i}`] = `refs/heads/${branch}`;
    });
    const data = await client.graphql<HistoryData>(branchHistoriesQuery(names.length), variables);
    if (!data.repository) throw new GitHubError("network", `GitHub repository not found: ${repo}`);
    // A branch deleted since it was listed comes back null and has nothing to count.
    return names.flatMap((branch, i): RawBranchHistory[] => {
      const ref = data.repository![`b${i}`];
      return ref ? [{ name: branch, target: ref.target }] : [];
    });
  });

  const result = new Map<string, RawBranchHistory[]>(repos.map((repo) => [repo.nameWithOwner, []]));
  chunks.forEach(({ repo }, i) => result.get(repo)!.push(...fetched[i]));
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
