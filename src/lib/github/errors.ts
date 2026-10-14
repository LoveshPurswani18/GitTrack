import "server-only";

export type GitHubErrorKind = "token" | "rate_limit" | "network";

export class GitHubError extends Error {
  readonly kind: GitHubErrorKind;
  readonly resetAt?: string; // ISO UTC, rate_limit only

  constructor(kind: GitHubErrorKind, message: string, options?: { resetAt?: string }) {
    super(message);
    this.name = "GitHubError";
    this.kind = kind;
    this.resetAt = options?.resetAt;
  }
}
