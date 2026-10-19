export type Repo = {
  nameWithOwner: string; // "owner/name"
  url: string;
  isPrivate: boolean;
  isWork: boolean; // owner === WORK_ORG
  defaultBranch: string;
};

export type Commit = {
  sha: string;
  repo: string; // Repo.nameWithOwner
  authoredAt: string; // ISO 8601, UTC — commit.author.date
  onDefault: boolean; // found on the repo's default branch; metrics ignore it
};

export type PullRequest = {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: "open" | "merged" | "closed"; // closed = closed without merging
  createdAt: string; // ISO UTC
  mergedAt: string | null;
  closedAt: string | null;
};

export type Activity = {
  username: string;
  fetchedAt: string; // ISO UTC, shown as "Updated 3 min ago"
  windowStart: string; // now − 365 days
  windowEnd: string; // now
  repos: Repo[];
  commits: Commit[];
  pullRequests: PullRequest[];
  restrictedCount: number; // from GraphQL; 0 means the token sees everything
  crossCheck: { date: string; count: number }[]; // GitHub's per-day counts, debug only
  // Default-branch commits dropped because my PR's own commits replace them (squash and rebase
  // merges). Debug only: the `onDefault` commits plus these equal what GitHub counts.
  supersededCommits: Commit[];
};
