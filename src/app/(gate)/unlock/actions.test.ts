import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startSession = vi.fn();

vi.mock("@/lib/auth/session", () => ({ startSession }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const KEY = "an-access-key-for-tests-only";

function form(username: string, key: string) {
  const data = new FormData();
  data.set("username", username);
  data.set("key", key);
  return data;
}

beforeEach(() => {
  startSession.mockReset().mockResolvedValue(undefined);
  vi.stubEnv("AUTH_KEY_HASH", createHash("sha256").update(KEY).digest("hex"));
  vi.stubEnv("AUTH_COOKIE_SECRET", "s".repeat(44));
  vi.stubEnv("GITHUB_USERNAME", "demo-user");
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function submit(username: string, key: string) {
  const { unlock } = await import("./actions");
  const result = unlock({ failed: false }, form(username, key));
  // A wrong login waits a second before it answers; the right one does not wait.
  const settled = result.catch((error: Error) => error);
  await vi.advanceTimersByTimeAsync(1000);
  return { outcome: await settled, startSession };
}

describe("unlock", () => {
  it("starts the session and goes to the dashboard on the right login", async () => {
    const { outcome } = await submit("demo-user", KEY);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual(new Error("NEXT_REDIRECT:/"));
  });

  it("answers the right username in the wrong case like any wrong login: the check is case sensitive", async () => {
    const { outcome } = await submit("Demo-User", KEY);
    expect(outcome).toEqual({ failed: true });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("answers a wrong key with one generic failure and no session", async () => {
    const { outcome } = await submit("demo-user", `${KEY}x`);
    expect(outcome).toEqual({ failed: true });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("answers a wrong username the same way", async () => {
    const { outcome } = await submit("someone-else", KEY);
    expect(outcome).toEqual({ failed: true });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("makes a wrong login wait about a second", async () => {
    const { unlock } = await import("./actions");
    let answered = false;
    void unlock({ failed: false }, form("demo-user", "wrong")).then(() => {
      answered = true;
    });
    await vi.advanceTimersByTimeAsync(900);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(answered).toBe(true);
  });

  it("refuses everyone when the gate is not configured, even with the right key", async () => {
    vi.stubEnv("AUTH_KEY_HASH", "");
    const { outcome } = await submit("demo-user", KEY);
    expect(outcome).toEqual({ failed: true });
    expect(startSession).not.toHaveBeenCalled();
  });
});
