import { describe, expect, it } from "vitest";
import { stateCopy } from "./stateCopy";

describe("stateCopy", () => {
  it("explains a rate limit with the cache time and the reset time", () => {
    const copy = stateCopy(
      { kind: "rate_limit", message: "x", resetAt: "2026-10-20T10:30:00Z" },
      { cachedAt: "14:05", resetAt: "14:32" },
    );
    expect(copy.tone).toBe("warning");
    expect(copy.title).toBe("GitHub rate limit reached");
    expect(copy.detail).toBe("Showing cached data from 14:05. Refresh works again at 14:32.");
  });

  it("copes with a rate limit that has no reset time or no cache", () => {
    const noReset = stateCopy({ kind: "rate_limit", message: "x" }, { cachedAt: "14:05" });
    expect(noReset.detail).toBe("Showing cached data from 14:05.");
    const bare = stateCopy({ kind: "rate_limit", message: "x" }, {});
    expect(bare.detail).toBe("Try again in a few minutes.");
  });

  it("is a danger banner for a rejected token, with or without a cache", () => {
    for (const times of [{}, { cachedAt: "14:05" }]) {
      const copy = stateCopy({ kind: "token", message: "x" }, times);
      expect(copy.tone).toBe("danger");
      expect(copy.title).toBe("GitHub token rejected");
      expect(copy.detail).toContain("GITHUB_TOKEN");
    }
  });

  it("is a danger banner for a network failure", () => {
    expect(stateCopy({ kind: "network", message: "x" }, {}).detail).toBe(
      "Check your connection, then try again.",
    );
    expect(stateCopy({ kind: "network", message: "x" }, { cachedAt: "14:05" }).detail).toBe(
      "Showing cached data from 14:05.",
    );
  });

  it("never repeats the raw error message", () => {
    const copy = stateCopy({ kind: "token", message: "secret-ish detail" }, {});
    expect(JSON.stringify(copy)).not.toContain("secret-ish");
  });
});
