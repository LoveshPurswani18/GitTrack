import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession, SESSION_COOKIE } from "./cookie";

const jar = new Map<string, string>();
const set = vi.fn((name: string, value: string, options: unknown) => {
  jar.set(name, value);
  return options;
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set,
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const SECRET = "s".repeat(44);
const ENV = {
  AUTH_KEY_HASH: "a".repeat(64),
  AUTH_COOKIE_SECRET: SECRET,
  GITHUB_USERNAME: "demo-user",
};

async function load() {
  return import("./session");
}

beforeEach(() => {
  jar.clear();
  set.mockClear();
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
});
afterEach(() => vi.unstubAllEnvs());

describe("requireSession", () => {
  it("passes with a valid pass", async () => {
    jar.set(SESSION_COOKIE, signSession(SECRET));
    const { requireSession } = await load();
    await expect(requireSession()).resolves.toBeUndefined();
  });

  it("sends a visitor with no pass to the unlock screen", async () => {
    const { requireSession } = await load();
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/unlock");
  });

  it("sends a visitor with a forged, expired or other-secret pass to the unlock screen", async () => {
    const { requireSession } = await load();
    for (const value of ["garbage", signSession("t".repeat(44)), signSession(SECRET, Date.now() - 31 * 86_400_000)]) {
      jar.set(SESSION_COOKIE, value);
      await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/unlock");
    }
  });

  it("refuses everyone when the gate is not configured, even with a pass signed with the old secret", async () => {
    jar.set(SESSION_COOKIE, signSession(SECRET));
    vi.stubEnv("AUTH_COOKIE_SECRET", "");
    const { requireSession } = await load();
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/unlock");
  });
});

describe("startSession and endSession", () => {
  it("sets a signed pass with the cookie rules: httpOnly, strict, whole site, 30 days", async () => {
    const { startSession, hasSession } = await load();
    await startSession();
    const [name, value, options] = set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/", maxAge: 2_592_000 });
    expect(value).toMatch(/^v1\.\d+\./);
    await expect(hasSession()).resolves.toBe(true);
  });

  it("marks the pass Secure in production only", async () => {
    const { startSession } = await load();
    vi.stubEnv("NODE_ENV", "production");
    await startSession();
    expect(set.mock.calls[0][2]).toMatchObject({ secure: true });
    set.mockClear();
    vi.stubEnv("NODE_ENV", "development");
    await startSession();
    expect(set.mock.calls[0][2]).toMatchObject({ secure: false });
  });

  it("does not start a session when the gate is not configured", async () => {
    vi.stubEnv("AUTH_KEY_HASH", "");
    const { startSession } = await load();
    await expect(startSession()).rejects.toThrow("not configured");
  });

  it("endSession removes the pass", async () => {
    jar.set(SESSION_COOKIE, signSession(SECRET));
    const { endSession, hasSession } = await load();
    await endSession();
    await expect(hasSession()).resolves.toBe(false);
  });
});
