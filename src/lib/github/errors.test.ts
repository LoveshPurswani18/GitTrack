import { describe, expect, it } from "vitest";
import {
  GitHubError,
  classifyGraphQLErrors,
  classifyHttpError,
  deserializeError,
  networkError,
  serializeError,
} from "./errors";

const NOW = new Date("2026-10-14T12:00:00Z");
const headers = (values: Record<string, string> = {}) => new Headers(values);

describe("classifyHttpError", () => {
  it("maps 401 to token", () => {
    const error = classifyHttpError({ status: 401, headers: headers(), message: "Bad credentials", now: NOW });
    expect(error.kind).toBe("token");
  });

  it("maps 403 Bad credentials to token", () => {
    const error = classifyHttpError({ status: 403, headers: headers(), message: "Bad credentials", now: NOW });
    expect(error.kind).toBe("token");
  });

  it("maps 403 with no remaining requests to rate_limit with a reset time", () => {
    const reset = String(Date.parse("2026-10-14T12:30:00Z") / 1000);
    const error = classifyHttpError({
      status: 403,
      headers: headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset }),
      message: "API rate limit exceeded",
      now: NOW,
    });
    expect(error.kind).toBe("rate_limit");
    expect(error.resetAt).toBe("2026-10-14T12:30:00.000Z");
  });

  it("maps a secondary rate limit (retry-after) to rate_limit", () => {
    const error = classifyHttpError({
      status: 403,
      headers: headers({ "retry-after": "60" }),
      message: "You have exceeded a secondary rate limit",
      now: NOW,
    });
    expect(error.kind).toBe("rate_limit");
    expect(error.resetAt).toBe("2026-10-14T12:01:00.000Z");
  });

  it("uses retry-after, not x-ratelimit-reset, when both are present", () => {
    const reset = String(Date.parse("2026-10-14T13:00:00Z") / 1000); // primary window, an hour away
    const error = classifyHttpError({
      status: 403,
      headers: headers({ "retry-after": "60", "x-ratelimit-reset": reset, "x-ratelimit-remaining": "4000" }),
      message: "You have exceeded a secondary rate limit",
      now: NOW,
    });
    expect(error.kind).toBe("rate_limit");
    expect(error.resetAt).toBe("2026-10-14T12:01:00.000Z");
  });

  it("recognises a secondary limit by its message when no headers say so", () => {
    const error = classifyHttpError({
      status: 403,
      headers: headers({ "x-ratelimit-remaining": "4000" }),
      message: "You have exceeded a secondary rate limit. Please wait a few minutes",
      now: NOW,
    });
    expect(error.kind).toBe("rate_limit");
    expect(error.resetAt).toBeUndefined();
  });

  it("maps 429 without headers to rate_limit with no reset time", () => {
    const error = classifyHttpError({ status: 429, headers: headers(), now: NOW });
    expect(error.kind).toBe("rate_limit");
    expect(error.resetAt).toBeUndefined();
  });

  it("maps another 403 to token", () => {
    const error = classifyHttpError({ status: 403, headers: headers(), message: "Resource not accessible", now: NOW });
    expect(error.kind).toBe("token");
  });

  it("maps 5xx and unexpected statuses to network", () => {
    expect(classifyHttpError({ status: 502, headers: headers(), now: NOW }).kind).toBe("network");
    expect(classifyHttpError({ status: 404, headers: headers(), now: NOW }).kind).toBe("network");
  });

  it("never puts the request token in a message", () => {
    const token = "ghp_secretvalue123";
    const messages = [401, 403, 429, 500, 404].map(
      (status) => classifyHttpError({ status, headers: headers(), message: "Bad credentials", now: NOW }).message,
    );
    expect(messages.some((m) => m.includes(token))).toBe(false);
    expect(networkError().message).not.toContain(token);
  });

  it("shortens a very long GitHub message", () => {
    const error = classifyHttpError({ status: 403, headers: headers(), message: "x".repeat(1000), now: NOW });
    expect(error.message.length).toBeLessThan(300);
  });
});

describe("classifyGraphQLErrors", () => {
  it("maps RATE_LIMITED to rate_limit", () => {
    const error = classifyGraphQLErrors([{ type: "RATE_LIMITED", message: "limit" }], {
      hasData: false,
      resetAt: "2026-10-14T13:00:00.000Z",
    });
    expect(error?.kind).toBe("rate_limit");
    expect(error?.resetAt).toBe("2026-10-14T13:00:00.000Z");
  });

  it("maps access problems to token even when data came back", () => {
    expect(classifyGraphQLErrors([{ type: "FORBIDDEN", message: "no" }], { hasData: true })?.kind).toBe("token");
    expect(
      classifyGraphQLErrors([{ message: "Resource protected by organization SAML enforcement" }], { hasData: true })?.kind,
    ).toBe("token");
  });

  it("maps other errors with no data to network", () => {
    expect(classifyGraphQLErrors([{ message: "Could not resolve to a User" }], { hasData: false })?.kind).toBe("network");
  });

  it("tolerates other errors when data came back", () => {
    expect(classifyGraphQLErrors([{ type: "NOT_FOUND", message: "one node" }], { hasData: true })).toBeNull();
  });
});

describe("serializeError", () => {
  it("round-trips a GitHubError", () => {
    const original = new GitHubError("rate_limit", "GitHub rate limit reached", { resetAt: "2026-10-14T13:00:00.000Z" });
    const copy = deserializeError(serializeError(original));
    expect(copy).toBeInstanceOf(GitHubError);
    expect(copy.kind).toBe("rate_limit");
    expect(copy.message).toBe(original.message);
    expect(copy.resetAt).toBe(original.resetAt);
  });
});
