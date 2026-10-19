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

/** A GitHubError as plain data, so it can cross the `use cache` boundary as a return value. */
export type SerializedGitHubError = { kind: GitHubErrorKind; message: string; resetAt?: string };

export function serializeError(error: GitHubError): SerializedGitHubError {
  return { kind: error.kind, message: error.message, resetAt: error.resetAt };
}

export function deserializeError(data: SerializedGitHubError): GitHubError {
  return new GitHubError(data.kind, data.message, { resetAt: data.resetAt });
}

type HeaderReader = { get(name: string): string | null };

const MAX_MESSAGE_LENGTH = 200;

function shorten(message: string | undefined): string {
  const text = (message ?? "").trim();
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

/** When the rate limit resets, from `retry-after` (seconds) if present, else `x-ratelimit-reset` (epoch seconds). */
export function resetAtFromHeaders(headers: HeaderReader, now: Date): string | undefined {
  // retry-after marks a secondary limit and is the real wait; x-ratelimit-reset is the primary window.
  const retryAfter = Number(headers.get("retry-after"));
  if (headers.get("retry-after") && Number.isFinite(retryAfter)) {
    return new Date(now.getTime() + retryAfter * 1000).toISOString();
  }
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (headers.get("x-ratelimit-reset") && Number.isFinite(reset)) {
    return new Date(reset * 1000).toISOString();
  }
  return undefined;
}

export function networkError(): GitHubError {
  return new GitHubError("network", "Could not reach GitHub");
}

/**
 * Maps a non-OK HTTP response to a GitHubError. Messages are built from the status and
 * GitHub's own message only; nothing from the request (headers, token) is ever included.
 */
export function classifyHttpError(input: {
  status: number;
  headers: HeaderReader;
  message?: string;
  now: Date;
}): GitHubError {
  const { status, headers, message, now } = input;
  const detail = shorten(message);

  if (status === 401 || (status === 403 && /bad credentials/i.test(detail))) {
    return new GitHubError("token", `GitHub rejected the token (${status})`);
  }

  if (status === 403 || status === 429) {
    const exhausted = headers.get("x-ratelimit-remaining") === "0";
    const retryAfter = headers.get("retry-after") !== null;
    // A secondary limit can arrive without retry-after and with requests remaining.
    const limitedMessage = /rate limit/i.test(detail);
    if (exhausted || retryAfter || limitedMessage || status === 429) {
      return new GitHubError("rate_limit", "GitHub rate limit reached", {
        resetAt: resetAtFromHeaders(headers, now),
      });
    }
    return new GitHubError("token", `GitHub refused access (${status}): ${detail}`.trimEnd());
  }

  if (status >= 500) {
    return new GitHubError("network", `GitHub is unavailable (${status})`);
  }

  return new GitHubError("network", `Unexpected GitHub response (${status})`);
}

/**
 * Maps the `errors` array of a GraphQL response. Returns null when the errors are
 * tolerable: GitHub sometimes returns partial data alongside errors for single nodes.
 */
export function classifyGraphQLErrors(
  errors: { type?: string; message?: string }[],
  options: { hasData: boolean; resetAt?: string },
): GitHubError | null {
  if (errors.some((e) => e.type === "RATE_LIMITED")) {
    return new GitHubError("rate_limit", "GitHub rate limit reached", { resetAt: options.resetAt });
  }
  const accessProblem = errors.some(
    (e) => e.type === "FORBIDDEN" || /bad credentials|saml|resource protected/i.test(e.message ?? ""),
  );
  if (accessProblem) {
    return new GitHubError("token", "GitHub denied access to some data; check the token's scopes and SSO");
  }
  if (!options.hasData) {
    return new GitHubError("network", `GitHub returned errors: ${shorten(errors[0]?.message)}`);
  }
  return null;
}
