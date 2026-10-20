import { describe, expect, it } from "vitest";
import { commitCount, formatDay } from "./format";

describe("formatDay", () => {
  it("formats weekday, day and month", () => {
    expect(formatDay("2025-10-14")).toBe("Tue, 14 Oct");
    expect(formatDay("2025-01-01")).toBe("Wed, 1 Jan");
  });

  it("does not depend on the process timezone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati";
      expect(formatDay("2025-10-14")).toBe("Tue, 14 Oct");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("commitCount", () => {
  it("pluralises", () => {
    expect(commitCount(0)).toBe("0 commits");
    expect(commitCount(1)).toBe("1 commit");
    expect(commitCount(6)).toBe("6 commits");
  });
});
