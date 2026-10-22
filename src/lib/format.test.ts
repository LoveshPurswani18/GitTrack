import { describe, expect, it } from "vitest";
import { commitCount, formatDay, formatDayMonth, repoLabels, repoName } from "./format";

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

describe("formatDayMonth", () => {
  it("formats day and month with no weekday", () => {
    expect(formatDayMonth("2026-10-10")).toBe("10 Oct");
    expect(formatDayMonth("2026-01-05")).toBe("5 Jan");
  });

  it("spells September as Sep", () => {
    expect(formatDayMonth("2026-09-21")).toBe("21 Sep");
  });
});

describe("commitCount", () => {
  it("pluralises", () => {
    expect(commitCount(0)).toBe("0 commits");
    expect(commitCount(1)).toBe("1 commit");
    expect(commitCount(6)).toBe("6 commits");
  });
});

describe("repoName", () => {
  it("drops the owner", () => {
    expect(repoName("demo-user/gittrack")).toBe("gittrack");
  });

  it("leaves a name without an owner alone", () => {
    expect(repoName("dotfiles")).toBe("dotfiles");
  });
});

describe("repoLabels", () => {
  it("uses bare names when they are unique", () => {
    const labels = repoLabels(["me/app", "me/dotfiles"]);
    expect(labels.get("me/app")).toBe("app");
    expect(labels.get("me/dotfiles")).toBe("dotfiles");
  });

  it("keeps the owner on names that collide, and only on those", () => {
    const labels = repoLabels(["me/app", "org/app", "me/dotfiles"]);
    expect(labels.get("me/app")).toBe("me/app");
    expect(labels.get("org/app")).toBe("org/app");
    expect(labels.get("me/dotfiles")).toBe("dotfiles");
  });
});
