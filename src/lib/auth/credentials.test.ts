import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkCredentials } from "./credentials";
import type { GateConfig } from "./gate";

const KEY = "correct-horse-battery-staple-test";
const gate = {
  ready: true,
  keyHash: createHash("sha256").update(KEY).digest("hex"),
  cookieSecret: "s".repeat(44),
  username: "Demo-User",
} satisfies Extract<GateConfig, { ready: true }>;

describe("checkCredentials", () => {
  it("accepts the right username and key", () => {
    expect(checkCredentials({ username: "Demo-User", key: KEY }, gate)).toBe(true);
  });

  it("compares the username exactly with GITHUB_USERNAME: capitals count", () => {
    expect(checkCredentials({ username: "demo-user", key: KEY }, gate)).toBe(false);
    expect(checkCredentials({ username: "DEMO-USER", key: KEY }, gate)).toBe(false);
    expect(checkCredentials({ username: "Demo-user", key: KEY }, gate)).toBe(false);
  });

  it("ignores spaces around the username", () => {
    expect(checkCredentials({ username: "  Demo-User ", key: KEY }, gate)).toBe(true);
  });

  it("rejects a wrong key", () => {
    expect(checkCredentials({ username: "Demo-User", key: `${KEY}x` }, gate)).toBe(false);
    expect(checkCredentials({ username: "Demo-User", key: KEY.toUpperCase() }, gate)).toBe(false);
  });

  it("does not trim the key: it is hashed exactly as typed", () => {
    expect(checkCredentials({ username: "Demo-User", key: ` ${KEY}` }, gate)).toBe(false);
    expect(checkCredentials({ username: "Demo-User", key: `${KEY}\n` }, gate)).toBe(false);
  });

  it("rejects a wrong or empty username", () => {
    expect(checkCredentials({ username: "someone-else", key: KEY }, gate)).toBe(false);
    expect(checkCredentials({ username: "", key: KEY }, gate)).toBe(false);
  });

  it("rejects an empty key, and a key hashing to nothing useful", () => {
    expect(checkCredentials({ username: "Demo-User", key: "" }, gate)).toBe(false);
    const emptyHashGate = { ...gate, keyHash: createHash("sha256").update("").digest("hex") };
    expect(checkCredentials({ username: "Demo-User", key: "" }, emptyHashGate)).toBe(false);
  });

  it("rejects an oversized key instead of hashing it", () => {
    const long = "a".repeat(100_000);
    const longGate = { ...gate, keyHash: createHash("sha256").update(long).digest("hex") };
    expect(checkCredentials({ username: "Demo-User", key: long }, longGate)).toBe(false);
  });
});
