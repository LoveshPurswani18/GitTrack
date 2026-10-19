import "server-only";

import {
  GitHubError,
  classifyGraphQLErrors,
  classifyHttpError,
  networkError,
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
  /** Runs `fn` over `items` with at most `limit` in flight; results keep the input order. */
  pool<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]>;
};

export type ClientOptions = {
  token: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const NEXT_LINK = /<([^>]+)>;\s*rel="next"/;

export function createGitHubClient(options: ClientOptions): GitHubClient {
  const { token, fetchImpl = fetch, now = () => new Date() } = options;

  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetchImpl(url, {
        ...init,
        cache: "no-store", // caching is done once, around getActivity(), not per request
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "gittrack",
          ...init.headers,
        },
      });
    } catch {
      throw networkError();
    }
  }

  async function failure(res: Response): Promise<GitHubError> {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : undefined;
    return classifyHttpError({ status: res.status, headers: res.headers, message, now: now() });
  }

  const resolve = (path: string) => (path.startsWith("http") ? path : `${API_URL}${path}`);

  return {
    async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
      const res = await send(`${API_URL}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw await failure(res);

      const body = (await res.json().catch(() => null)) as {
        data?: T | null;
        errors?: { type?: string; message?: string }[];
      } | null;
      if (!body) throw new GitHubError("network", "GitHub returned an unreadable response");

      if (body.errors?.length) {
        const error = classifyGraphQLErrors(body.errors, {
          hasData: Boolean(body.data),
          resetAt: resetAtFromHeaders(res.headers, now()),
        });
        if (error) throw error;
      }
      if (!body.data) throw new GitHubError("network", "GitHub returned no data");
      return body.data;
    },

    async rest<T>(path: string): Promise<T> {
      const res = await send(resolve(path));
      if (!res.ok) throw await failure(res);
      const body: unknown = await res.json().catch(() => undefined);
      if (body === undefined) throw new GitHubError("network", "GitHub returned an unreadable response");
      return body as T;
    },

    async restPages<T>(path: string): Promise<T[]> {
      const items: T[] = [];
      let url: string | null = resolve(path);
      for (let page = 0; url; page++) {
        if (page >= MAX_PAGES) throw new GitHubError("network", "GitHub returned too many pages");
        const res = await send(url);
        if (res.status === 409) break; // empty repository: no commits
        if (!res.ok) throw await failure(res);
        const body: unknown = await res.json().catch(() => null);
        if (!Array.isArray(body)) throw new GitHubError("network", "GitHub returned an unexpected list");
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
