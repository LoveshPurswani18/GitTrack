import type { Activity, Commit, PullRequest, Repo } from "@/types/activity";

export const PERSONAL_REPO = "demo-user/gittrack";
export const WORK_REPO_A = "work-org/work-repo-a";
export const WORK_REPO_B = "work-org/work-repo-b";

export function repo(nameWithOwner: string, isWork = false): Repo {
  return {
    nameWithOwner,
    url: `https://github.com/${nameWithOwner}`,
    isPrivate: false,
    isWork,
    defaultBranch: "main",
  };
}

let shaCounter = 0;

export function commit(repoName: string, authoredAt: string): Commit {
  shaCounter += 1;
  return { sha: `sha-${shaCounter}`, repo: repoName, authoredAt };
}

export function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    repo: PERSONAL_REPO,
    number: 1,
    title: "Add a thing",
    url: "https://github.com/demo-user/gittrack/pull/1",
    state: "open",
    createdAt: "2026-10-10T10:00:00Z",
    mergedAt: null,
    closedAt: null,
    ...overrides,
  };
}

export function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    username: "demo-user",
    fetchedAt: "2026-10-14T12:00:00Z",
    windowStart: "2025-10-14T12:00:00Z",
    windowEnd: "2026-10-14T12:00:00Z",
    repos: [repo(PERSONAL_REPO), repo(WORK_REPO_A, true), repo(WORK_REPO_B, true)],
    commits: [],
    pullRequests: [],
    restrictedCount: 0,
    crossCheck: [],
    ...overrides,
  };
}
