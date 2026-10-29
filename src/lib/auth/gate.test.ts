import { describe, expect, it } from "vitest";
import { parseGate } from "./gate";

const HASH = "a".repeat(64);
const SECRET = "s".repeat(44);
const ready = { AUTH_KEY_HASH: HASH, AUTH_COOKIE_SECRET: SECRET, GITHUB_USERNAME: "demo-user" };

describe("parseGate", () => {
  it("is ready with all three values", () => {
    expect(parseGate(ready)).toEqual({ ready: true, keyHash: HASH, cookieSecret: SECRET, username: "demo-user" });
  });

  it("trims the values and lowercases the hash", () => {
    const gate = parseGate({
      AUTH_KEY_HASH: `  ${"A".repeat(64)}\n`,
      AUTH_COOKIE_SECRET: ` ${SECRET} `,
      GITHUB_USERNAME: " demo-user ",
    });
    expect(gate).toEqual({ ready: true, keyHash: HASH, cookieSecret: SECRET, username: "demo-user" });
  });

  it("is unavailable, naming only the variable, when something is missing", () => {
    for (const name of Object.keys(ready)) {
      const env: Record<string, string | undefined> = { ...ready, [name]: undefined };
      expect(parseGate(env)).toEqual({ ready: false, reason: `missing ${name}` });
    }
    expect(parseGate({})).toEqual({
      ready: false,
      reason: "missing AUTH_KEY_HASH, AUTH_COOKIE_SECRET, GITHUB_USERNAME",
    });
  });

  it("treats blank values as missing", () => {
    expect(parseGate({ ...ready, AUTH_COOKIE_SECRET: "   " })).toEqual({
      ready: false,
      reason: "missing AUTH_COOKIE_SECRET",
    });
  });

  it("rejects a hash that is not 64 hexadecimal characters", () => {
    for (const bad of ["abc", "g".repeat(64), "a".repeat(63), "a".repeat(65)]) {
      expect(parseGate({ ...ready, AUTH_KEY_HASH: bad })).toMatchObject({ ready: false });
    }
  });

  it("rejects a cookie secret shorter than 32 characters", () => {
    expect(parseGate({ ...ready, AUTH_COOKIE_SECRET: "s".repeat(31) })).toMatchObject({ ready: false });
    expect(parseGate({ ...ready, AUTH_COOKIE_SECRET: "s".repeat(32) })).toMatchObject({ ready: true });
  });

  it("never puts a value in the reason", () => {
    const bad = parseGate({ ...ready, AUTH_KEY_HASH: "not-a-hash-secret-value" });
    expect(JSON.stringify(bad)).not.toContain("not-a-hash-secret-value");
  });
});
