import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

const liveEnv = {
  GITHUB_DATA: "live",
  GITHUB_TOKEN: "token",
  GITHUB_USERNAME: "demo-user",
  WORK_ORG: "work-org",
};

describe("parseConfig", () => {
  it("defaults to fixtures with nothing set", () => {
    expect(parseConfig({}).dataSource).toBe("fixtures");
  });

  it("falls back to fixtures for any value other than live", () => {
    expect(parseConfig({ GITHUB_DATA: "LIVE" }).dataSource).toBe("fixtures");
    expect(parseConfig({ GITHUB_DATA: "production" }).dataSource).toBe("fixtures");
  });

  it("does not require a token in fixtures mode", () => {
    expect(parseConfig({ GITHUB_DATA: "fixtures" }).token).toBeUndefined();
  });

  it("accepts a complete live configuration", () => {
    const config = parseConfig(liveEnv);
    expect(config).toMatchObject({ dataSource: "live", username: "demo-user", workOrg: "work-org" });
  });

  it("lists every missing variable in live mode", () => {
    expect(() => parseConfig({ GITHUB_DATA: "live" })).toThrow(
      "GITHUB_TOKEN, GITHUB_USERNAME, WORK_ORG",
    );
  });

  it("does not echo the token in the error", () => {
    expect(() => parseConfig({ GITHUB_DATA: "live", GITHUB_TOKEN: "secret-value" })).not.toThrow(
      /secret-value/,
    );
  });

  it("reads known fixture states and ignores unknown ones", () => {
    expect(parseConfig({ GITHUB_FIXTURE_STATE: "rate_limit" }).fixtureState).toBe("rate_limit");
    expect(parseConfig({ GITHUB_FIXTURE_STATE: "bogus" }).fixtureState).toBeNull();
  });

  it("ignores the fixture state in live mode", () => {
    expect(parseConfig({ ...liveEnv, GITHUB_FIXTURE_STATE: "empty" }).fixtureState).toBeNull();
  });
});
