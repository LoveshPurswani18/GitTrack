import "server-only";

export type DataSource = "fixtures" | "live";
export type FixtureState = "empty" | "rate_limit" | "token_error";

export type Config = {
  dataSource: DataSource;
  token: string | undefined;
  username: string | undefined;
  workOrg: string | undefined;
  fixtureState: FixtureState | null; // fixtures mode only
};

const FIXTURE_STATES: readonly string[] = ["empty", "rate_limit", "token_error"];

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseConfig(env: Env): Config {
  const requested = clean(env.GITHUB_DATA);
  if (requested !== undefined && requested !== "live" && requested !== "fixtures") {
    throw new Error('GITHUB_DATA must be "live" or "fixtures"');
  }
  const dataSource: DataSource = requested === "live" ? "live" : "fixtures";
  const token = clean(env.GITHUB_TOKEN);
  const username = clean(env.GITHUB_USERNAME);
  const workOrg = clean(env.WORK_ORG);

  if (dataSource === "live") {
    const missing = [
      ["GITHUB_TOKEN", token],
      ["GITHUB_USERNAME", username],
      ["WORK_ORG", workOrg],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Missing environment variables for live mode: ${missing.join(", ")}`);
    }
  }

  const state = clean(env.GITHUB_FIXTURE_STATE);
  const fixtureState =
    dataSource === "fixtures" && state && FIXTURE_STATES.includes(state)
      ? (state as FixtureState)
      : null;

  return { dataSource, token, username, workOrg, fixtureState };
}

export function getConfig(): Config {
  return parseConfig(process.env);
}
