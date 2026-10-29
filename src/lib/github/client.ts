import "server-only";

import {
  GitHubError,
  classifyGraphQLErrors,
  classifyHttpError,
  networkError,
  redactForLog,
  resetAtFromHeaders,
} from "./errors";

const API_URL = "https://api.github.com";
const MAX_PAGES = 100;

/** How many REST requests may run at once. */
export const MAX_PARALLEL_REQUESTS = 6;

export type GitHubClient = {
  /** One GraphQL query; resolves to `data`. */
  graphql<T>(query: string, variables: Record<string, unknown>): Promise<T>;
  /** One REST request; resolves to the JSON body. */
  rest<T>(path: string): Promise<T>;
  /** A REST list endpoint, following `Link: rel="next"` and returning all items. */
  restPages<T>(path: string): Promise<T[]>;
  /** Writes one line to the same log as failed requests. */
  log(line: string): void;
  /** Runs `fn` over `items` with at most `limit` in flight; results keep the input order. */
  pool<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]>;
};

export type ClientOptions = {
  token: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Receives one line per failed request. Defaults to console.error. */
  log?: (line: string) => void;
  /** Gives up on a single attempt after this long. Default 30 seconds. */
  timeoutMs?: number;
  /** Wait before the one retry. Default 1 second. */
  retryDelayMs?: number;
};

/** Statuses that mean GitHub was briefly unavailable, so the same read-only request is retried once. */
const RETRY_STATUSES = new Set([502, 503, 504]);

const NEXT_LINK = /<([^>]+)>;\s*rel="next"/;

/** GraphQL: the operation name. REST: the path without its query string, repo and user masked. */
function graphqlLabel(query: string): string {
  return `graphql ${/\bquery\s+(\w+)/.exec(query)?.[1] ?? "(unnamed)"}`;
}

function restLabel(path: string): string {
  const bare = path.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  return `rest ${bare.replace(/^\/repos\/[^/]+\/[^/]+/, "/repos/:repo").replace(/^\/users\/[^/]+/, "/users/:user")}`;
}

/** The low-level reason a fetch threw, e.g. ECONNRESET or UND_ERR_HEADERS_TIMEOUT. */
function fetchCause(error: unknown): string {
  type Reason = { name?: string; code?: unknown };
  const err = error as (Reason & { cause?: Reason }) | null;
  // A timeout is a DOMException whose numeric `code` (23) says less than its name.
  const text = (code: unknown) => (typeof code === "string" ? code : undefined);
  return text(err?.cause?.code) ?? text(err?.code) ?? err?.cause?.name ?? err?.name ?? "unknown";
}

export function createGitHubClient(options: ClientOptions): GitHubClient {
  const {
    token,
    fetchImpl = fetch,
    now = () => new Date(),
    log = console.error,
    timeoutMs = 30_000,
    retryDelayMs = 1_000,
  } = options;

  /** One line per failed request: kind, which call, HTTP status, time taken and the reason. */
  function report(label: string, started: number, error: GitHubError, status: number | "none", reason?: string) {
    const ms = Date.now() - started;
    log(`[github] ${error.kind} ${label} status=${status} ${ms}ms: ${redactForLog(reason ?? error.message)}`);
    return error;
  }

  /** One request with a timeout. A thrown fetch or a 502/503/504 is retried once; the rest is not. */
  async function send(url: string, label: string, started: number, init: RequestInit = {}): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const retry = attempt === 1;
      let res: Response;
      try {
        res = await fetchImpl(url, {
          ...init,
          cache: "no-store", // caching is done once, around getActivity(), not per request
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "gittrack",
            ...init.headers,
          },
        });
      } catch (cause) {
        const reason = `fetch failed (${fetchCause(cause)})`;
        const error = report(label, started, networkError(), "none", retry ? `${reason}; retrying` : reason);
        if (!retry) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      if (!retry || !RETRY_STATUSES.has(res.status)) return res;
      void res.body?.cancel().catch(() => {}); // release the connection; the body is not needed
      report(label, started, new GitHubError("network", `GitHub is unavailable (${res.status})`), res.status, `GitHub is unavailable (${res.status}); retrying`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  async function failure(res: Response, label: string, started: number): Promise<GitHubError> {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : undefined;
    const error = classifyHttpError({ status: res.status, headers: res.headers, message, now: now() });
    return report(label, started, error, res.status, message ? `${error.message} - ${message}` : undefined);
  }

  const resolve = (path: string) => (path.startsWith("http") ? path : `${API_URL}${path}`);

  return {
    log,
    async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
      const label = graphqlLabel(query);
      const started = Date.now();
      const res = await send(`${API_URL}/graphql`, label, started, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw await failure(res, label, started);

      const body = (await res.json().catch(() => null)) as {
        data?: T | null;
        errors?: { type?: string; message?: string }[];
      } | null;
      if (!body) {
        throw report(label, started, new GitHubError("network", "GitHub returned an unreadable response"), res.status);
      }

      if (body.errors?.length) {
        const error = classifyGraphQLErrors(body.errors, {
          hasData: Boolean(body.data),
          resetAt: resetAtFromHeaders(res.headers, now()),
        });
        if (error) {
          const first = body.errors[0];
          throw report(label, started, error, res.status, `${error.message} - ${first?.type ?? "no type"}: ${first?.message ?? ""}`);
        }
      }
      if (!body.data) throw report(label, started, new GitHubError("network", "GitHub returned no data"), res.status);
      return body.data;
    },

    async rest<T>(path: string): Promise<T> {
      const label = restLabel(path);
      const started = Date.now();
      const res = await send(resolve(path), label, started);
      if (!res.ok) throw await failure(res, label, started);
      const body: unknown = await res.json().catch(() => undefined);
      if (body === undefined) {
        throw report(label, started, new GitHubError("network", "GitHub returned an unreadable response"), res.status);
      }
      return body as T;
    },

    async restPages<T>(path: string): Promise<T[]> {
      const items: T[] = [];
      const label = restLabel(path);
      let url: string | null = resolve(path);
      for (let page = 0; url; page++) {
        if (page >= MAX_PAGES) throw new GitHubError("network", "GitHub returned too many pages");
        const started = Date.now();
        const res = await send(url, label, started);
        if (res.status === 409) break; // empty repository: no commits
        if (!res.ok) throw await failure(res, label, started);
        const body: unknown = await res.json().catch(() => null);
        if (!Array.isArray(body)) {
          throw report(label, started, new GitHubError("network", "GitHub returned an unexpected list"), res.status);
        }
        items.push(...(body as T[]));
        url = NEXT_LINK.exec(res.headers.get("link") ?? "")?.[1] ?? null;
      }
      return items;
    },

    async pool<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
      const results = new Array<O>(items.length);
      let next = 0;
      const worker = async () => {
        while (next < items.length) {
          const index = next++;
          results[index] = await fn(items[index]);
        }
      };
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
      return results;
    },
  };
}
