import { describe, expect, it } from "vitest";
import { createFakeFetch, jsonResponse } from "@/test/fakeFetch";
import { MAX_PARALLEL_REQUESTS, createGitHubClient } from "./client";
import { GitHubError } from "./errors";

const TOKEN = "ghp_testtoken";
const NOW = new Date("2026-10-14T12:00:00Z");

function clientFor(handler: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(handler);
  const client = createGitHubClient({ token: TOKEN, fetchImpl: fake.fetch, now: () => NOW });
  return { client, fake };
}

describe("requests", () => {
  it("sends the auth header and a user agent, uncached", async () => {
    const { client, fake } = clientFor(() => jsonResponse({ login: "demo-user" }));
    await client.rest("/users/demo-user");
    const [request] = fake.requests;
    expect(request.url).toBe("https://api.github.com/users/demo-user");
    expect(request.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(request.headers.get("user-agent")).toBeTruthy();
  });

  it("posts GraphQL queries and returns data", async () => {
    const { client, fake } = clientFor(() => jsonResponse({ data: { user: { login: "demo-user" } } }));
    const data = await client.graphql<{ user: { login: string } }>("query { user }", { login: "demo-user" });
    expect(data.user.login).toBe("demo-user");
    expect(fake.requests[0].method).toBe("POST");
    expect(JSON.parse(fake.requests[0].body!)).toEqual({ query: "query { user }", variables: { login: "demo-user" } });
  });
});

describe("restPages", () => {
  it("follows Link rel=next and stops at the last page", async () => {
    const { client, fake } = clientFor((request) => {
      if (request.url.endsWith("?page=2")) return jsonResponse([{ n: 3 }]);
      return jsonResponse([{ n: 1 }, { n: 2 }], {
        headers: {
          link: '<https://api.github.com/repos/o/r/commits?page=2>; rel="next", <https://api.github.com/repos/o/r/commits?page=2>; rel="last"',
        },
      });
    });
    const items = await client.restPages<{ n: number }>("/repos/o/r/commits?per_page=100");
    expect(items.map((i) => i.n)).toEqual([1, 2, 3]);
    expect(fake.requests).toHaveLength(2);
  });

  it("does not send the token to a Link next URL on another host", async () => {
    const { client, fake } = clientFor(() =>
      jsonResponse([{ n: 1 }], { headers: { link: '<https://evil.example/steal?page=2>; rel="next"' } }),
    );
    await expect(client.restPages("/repos/o/r/commits")).rejects.toMatchObject({ kind: "network" });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests.every((r) => r.url.startsWith("https://api.github.com/"))).toBe(true);
  });

  it("refuses a relative-looking next link that would glue onto the API host", async () => {
    for (const next of [".evil.example/steal", "@evil.example/steal", ":8443/steal"]) {
      const { client, fake } = clientFor(() =>
        jsonResponse([{ n: 1 }], { headers: { link: `<${next}>; rel="next"` } }),
      );
      await expect(client.restPages("/repos/o/r/commits")).rejects.toMatchObject({ kind: "network" });
      expect(fake.requests).toHaveLength(1);
    }
  });

  it("refuses a caller-supplied full URL on another host", async () => {
    const { client, fake } = clientFor(() => jsonResponse([]));
    await expect(client.restPages("https://evil.example/x")).rejects.toMatchObject({ kind: "network" });
    expect(fake.requests).toHaveLength(0);
  });

  it("treats a 409 (empty repository) as no commits", async () => {
    const { client } = clientFor(() => jsonResponse({ message: "Git Repository is empty." }, { status: 409 }));
    expect(await client.restPages("/repos/o/r/commits")).toEqual([]);
  });

  it("fails when the body is not a list", async () => {
    const { client } = clientFor(() => jsonResponse({ not: "a list" }));
    await expect(client.restPages("/repos/o/r/commits")).rejects.toMatchObject({ kind: "network" });
  });
});

describe("errors", () => {
  it("maps a 401 to a token error without leaking the token", async () => {
    const { client } = clientFor(() => jsonResponse({ message: "Bad credentials" }, { status: 401 }));
    const error = await client.rest("/user").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubError);
    expect((error as GitHubError).kind).toBe("token");
    expect((error as GitHubError).message).not.toContain(TOKEN);
  });

  it("maps an exhausted rate limit to rate_limit with a reset time", async () => {
    const reset = String(Date.parse("2026-10-14T12:30:00Z") / 1000);
    const { client } = clientFor(() =>
      jsonResponse(
        { message: "API rate limit exceeded" },
        { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset } },
      ),
    );
    await expect(client.rest("/user")).rejects.toMatchObject({
      kind: "rate_limit",
      resetAt: "2026-10-14T12:30:00.000Z",
    });
  });

  it("maps an unreadable REST body (for example an HTML page from a proxy) to network", async () => {
    const { client } = clientFor(() => new Response("<html>bad gateway</html>", { status: 200 }));
    await expect(client.rest("/users/demo-user")).rejects.toMatchObject({ kind: "network" });
  });

  it("maps a rejected fetch to network", async () => {
    const client = createGitHubClient({
      token: TOKEN,
      fetchImpl: (() => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch,
    });
    await expect(client.rest("/user")).rejects.toMatchObject({ kind: "network" });
  });

  it("maps GraphQL RATE_LIMITED (HTTP 200) to rate_limit", async () => {
    const { client } = clientFor(() => jsonResponse({ data: null, errors: [{ type: "RATE_LIMITED", message: "limit" }] }));
    await expect(client.graphql("query { x }", {})).rejects.toMatchObject({ kind: "rate_limit" });
  });

  it("keeps partial GraphQL data when the errors are tolerable", async () => {
    const { client } = clientFor(() =>
      jsonResponse({ data: { user: { ok: true } }, errors: [{ type: "NOT_FOUND", message: "one node" }] }),
    );
    expect(await client.graphql("query { x }", {})).toEqual({ user: { ok: true } });
  });
});

describe("pool", () => {
  it("never runs more than the limit at once and keeps input order", async () => {
    const { client, fake } = clientFor(() => jsonResponse([]));
    const items = Array.from({ length: 20 }, (_, i) => i);
    const results = await client.pool(items, MAX_PARALLEL_REQUESTS, async (i) => {
      await client.rest(`/items/${i}`);
      return i * 2;
    });
    expect(results).toEqual(items.map((i) => i * 2));
    expect(fake.requests).toHaveLength(20);
    expect(fake.maxInFlight()).toBeLessThanOrEqual(6);
    expect(fake.maxInFlight()).toBeGreaterThan(1);
  });

  it("handles an empty list", async () => {
    const { client } = clientFor(() => jsonResponse([]));
    expect(await client.pool([], 6, async () => 1)).toEqual([]);
  });

  it("rejects when a task fails", async () => {
    const { client } = clientFor(() => jsonResponse([]));
    await expect(
      client.pool([1, 2, 3], 2, async (i) => {
        if (i === 2) throw new GitHubError("network", "boom");
        return i;
      }),
    ).rejects.toMatchObject({ kind: "network" });
  });
});

describe("failure logging", () => {
  function loggedClient(handler: Parameters<typeof createFakeFetch>[0]) {
    const lines: string[] = [];
    const fake = createFakeFetch(handler);
    const client = createGitHubClient({
      token: TOKEN,
      fetchImpl: fake.fetch,
      now: () => NOW,
      log: (line) => lines.push(line),
      retryDelayMs: 0,
    });
    return { client, lines, fake };
  }

  it("logs the kind, query name and status of a failed GraphQL call, never the token", async () => {
    const { client, lines } = loggedClient(() => jsonResponse({ message: "Bad gateway" }, { status: 502 }));
    await expect(client.graphql("query BranchHistories($a: Int) { x }", {})).rejects.toBeInstanceOf(GitHubError);
    expect(lines).toHaveLength(2); // the first try (retrying) and the retry
    expect(lines[0]).toMatch(/^\[github\] network graphql BranchHistories status=502 \d+ms: .*retrying/);
    expect(lines[1]).toMatch(/^\[github\] network graphql BranchHistories status=502 \d+ms: /);
    expect(lines.join("\n")).not.toContain(TOKEN);
  });

  it("logs the GraphQL error type when the body has errors and no data", async () => {
    const { client, lines } = loggedClient(() =>
      jsonResponse({ data: null, errors: [{ type: "TIMEOUT", message: "Query timed out" }] }),
    );
    await expect(client.graphql("query Activity { x }", {})).rejects.toBeInstanceOf(GitHubError);
    expect(lines[0]).toContain("graphql Activity status=200");
    expect(lines[0]).toContain("TIMEOUT: Query timed out");
  });

  it("masks repo and user names in REST paths and drops the query string", async () => {
    const { client, lines } = loggedClient(() => jsonResponse({ message: "Server Error" }, { status: 500 }));
    await expect(client.restPages("/repos/some-org/some-repo/commits?per_page=100")).rejects.toBeInstanceOf(GitHubError);
    await expect(client.rest("/users/some-user")).rejects.toBeInstanceOf(GitHubError);
    expect(lines[0]).toContain("rest /repos/:repo/commits status=500");
    expect(lines[1]).toContain("rest /users/:user status=500");
    expect(lines.join("\n")).not.toMatch(/some-org|some-repo|some-user|per_page/);
  });

  it("masks quoted names and owner/name pairs echoed in GitHub's message", async () => {
    const { client, lines } = loggedClient(() =>
      jsonResponse({ message: "Could not resolve 'secret-repo' for secret-org/secret-repo" }, { status: 404 }),
    );
    await expect(client.rest("/users/x")).rejects.toBeInstanceOf(GitHubError);
    expect(lines[0]).not.toMatch(/secret/);
  });

  it("logs the underlying cause when fetch itself throws", async () => {
    const lines: string[] = [];
    const client = createGitHubClient({
      token: TOKEN,
      fetchImpl: (async () => {
        throw new TypeError("fetch failed", { cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }) });
      }) as typeof fetch,
      log: (line) => lines.push(line),
      retryDelayMs: 0,
    });
    await expect(client.rest("/users/x")).rejects.toMatchObject({ kind: "network", message: "Could not reach GitHub" });
    expect(lines[0]).toMatch(/network rest \/users\/:user status=none \d+ms: fetch failed \(ECONNRESET\)/);
  });

  it("logs nothing on success", async () => {
    const { client, lines } = loggedClient(() => jsonResponse({ login: "demo-user" }));
    await client.rest("/users/demo-user");
    expect(lines).toEqual([]);
  });
});

describe("timeout and retry", () => {
  const reset = () => new TypeError("fetch failed", { cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }) });

  function flaky(outcomes: (Response | Error)[]) {
    const lines: string[] = [];
    let calls = 0;
    const fetchImpl = (async () => {
      const outcome = outcomes[Math.min(calls++, outcomes.length - 1)];
      if (outcome instanceof Error) throw outcome;
      return outcome.clone();
    }) as typeof fetch;
    const client = createGitHubClient({
      token: TOKEN,
      fetchImpl,
      now: () => NOW,
      log: (line) => lines.push(line),
      retryDelayMs: 0,
      timeoutMs: 50,
    });
    return { client, lines, calls: () => calls };
  }

  it("retries once after a connection reset and succeeds", async () => {
    const { client, lines, calls } = flaky([reset(), jsonResponse({ login: "demo-user" })]);
    await expect(client.rest("/users/demo-user")).resolves.toEqual({ login: "demo-user" });
    expect(calls()).toBe(2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("fetch failed (ECONNRESET); retrying");
  });

  it("gives up after the one retry", async () => {
    const { client, calls } = flaky([reset()]);
    await expect(client.rest("/users/demo-user")).rejects.toMatchObject({ kind: "network" });
    expect(calls()).toBe(2);
  });

  it("retries a 502 once and succeeds", async () => {
    const { client, calls } = flaky([jsonResponse({ message: "Bad gateway" }, { status: 502 }), jsonResponse({ ok: true })]);
    await expect(client.rest("/users/demo-user")).resolves.toEqual({ ok: true });
    expect(calls()).toBe(2);
  });

  it("does not retry a rejected token, a rate limit or a 500", async () => {
    for (const status of [401, 429, 500]) {
      const { client, calls } = flaky([jsonResponse({ message: "nope" }, { status })]);
      await expect(client.rest("/users/demo-user")).rejects.toBeInstanceOf(GitHubError);
      expect(calls()).toBe(1);
    }
  });

  it("times out a request that never answers", async () => {
    const lines: string[] = [];
    const client = createGitHubClient({
      token: TOKEN,
      fetchImpl: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        })) as typeof fetch,
      log: (line) => lines.push(line),
      timeoutMs: 20,
      retryDelayMs: 0,
    });
    await expect(client.rest("/users/demo-user")).rejects.toMatchObject({ kind: "network" });
    expect(lines[0]).toContain("fetch failed (TimeoutError); retrying");
    expect(lines).toHaveLength(2);
  });
});
