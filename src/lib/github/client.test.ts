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
