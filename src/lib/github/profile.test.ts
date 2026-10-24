import { describe, expect, it } from "vitest";
import type { Profile } from "@/types/profile";
import { GitHubError } from "./errors";
import { loadFixtureProfile } from "./fixtures";
import { resolveProfile } from "./profile";

const NOW = new Date("2026-10-20T10:00:00Z");
const profile: Profile = loadFixtureProfile(null, NOW);

describe("resolveProfile", () => {
  it("returns ok with the profile", async () => {
    expect(await resolveProfile(async () => profile)).toEqual({ status: "ok", profile });
  });

  it("returns an error result for a rate limit, with the reset time", async () => {
    const resetAt = "2026-10-20T10:30:00.000Z";
    const result = await resolveProfile(async () => {
      throw new GitHubError("rate_limit", "GitHub rate limit reached", { resetAt });
    });
    expect(result).toEqual({
      status: "error",
      error: { kind: "rate_limit", message: "GitHub rate limit reached", resetAt },
    });
  });

  it("maps the fixture states to results", async () => {
    const run = (state: "empty" | "rate_limit" | "token_error") =>
      resolveProfile(async () => loadFixtureProfile(state, NOW));
    expect((await run("empty")).status).toBe("ok");
    const limited = await run("rate_limit");
    expect(limited.status === "error" && limited.error.kind).toBe("rate_limit");
    const token = await run("token_error");
    expect(token.status === "error" && token.error.kind).toBe("token");
  });

  it("rethrows anything that is not a GitHubError", async () => {
    await expect(
      resolveProfile(async () => {
        throw new Error("Missing environment variables for live mode: GITHUB_TOKEN");
      }),
    ).rejects.toThrow("Missing environment variables");
  });
});
