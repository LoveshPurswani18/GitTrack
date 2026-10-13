#!/usr/bin/env node
// GitTrack v2, Phase 0 validation spike. THROWAWAY: only the findings carry over.
//
//   node --env-file=.env.local spike/spike.mjs [--full] [--sample N] [--seed S]
//   node spike/spike.mjs --selftest        (no env, no network)
//
// Env: GITHUB_TOKEN, GITHUB_USERNAME, WORK_ORG. GITHUB_DATA is ignored.
// Output contains real repo names. Do not paste it into chat, commits or docs.

const WINDOW_DAYS = 364;
const PAD_DAYS = 3;
const DAY_MS = 86_400_000;
const IST = 'Asia/Kolkata';
const CONCURRENCY = 5;
const MAX_PAGES = 30;
const SPEED_HINT_MS = 5000;

const argv = process.argv.slice(2);
const hasFlag = (n) => argv.includes(n);
const opt = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};

// ---------- pure helpers ----------

const fmtCache = new Map();
function dayKey(iso, tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f.format(new Date(iso)); // YYYY-MM-DD
}

function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function listDays(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function streaks(counts, today) {
  const days = new Set([...counts].filter(([, n]) => n > 0).map(([d]) => d));
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of [...days].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  let cursor = days.has(today) ? today : days.has(addDays(today, -1)) ? addDays(today, -1) : null;
  let current = 0;
  while (cursor && days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

function diffCounts(ref, other, days) {
  const rows = [];
  let absDiff = 0;
  for (const d of days) {
    const a = ref.get(d) ?? 0;
    const b = other.get(d) ?? 0;
    if (a !== b) {
      rows.push({ day: d, ref: a, other: b });
      absDiff += Math.abs(a - b);
    }
  }
  return { rows, absDiff };
}

function inspectOccurredAt(raws) {
  const nonMidnight = raws.filter((r) => !/T00:00:00(\.0+)?Z$/.test(r));
  return {
    first5: raws.slice(0, 5),
    nonMidnight,
    cleanUtcMidnight: raws.length > 0 && nonMidnight.length === 0,
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom(items, n, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n).sort();
}

function makeWindow(now) {
  const to = new Date(now);
  const from = new Date(to.getTime() - WINDOW_DAYS * DAY_MS);
  return { from, to };
}

const inWindow = (iso, w) => {
  const t = Date.parse(iso);
  return t >= w.from.getTime() && t <= w.to.getTime();
};

const nextLink = (header) => /<([^>]+)>;\s*rel="next"/.exec(header ?? '')?.[1] ?? null;

const hasCoAuthor = (message) => /co-authored-by/i.test(message ?? '');

// Days that are complete in both the UTC reference and the IST grouping: strictly inside
// the later start day and the earlier end day.
function interiorDays(firstUtc, lastUtc, firstIst, lastIst) {
  const lo = firstUtc > firstIst ? firstUtc : firstIst;
  const hi = lastUtc < lastIst ? lastUtc : lastIst;
  return listDays(addDays(lo, 1), addDays(hi, -1));
}

// results: [{ label, mismatches }]
function verdictText(results) {
  const best = Math.min(...results.map((r) => r.mismatches));
  const names = (arr) => arr.map((r) => r.label).join(', ');
  if (best === 0) {
    const ok = results.filter((r) => r.mismatches === 0);
    const bad = results.filter((r) => r.mismatches > 0);
    return ok.length === results.length
      ? `all ${results.length} groupings match the reference.`
      : `matches the reference: ${names(ok)}. Does not match: ${names(bad)}.`;
  }
  const closest = results.filter((r) => r.mismatches === best);
  return closest.length === results.length
    ? `no grouping matches; all have ${best} mismatching days.`
    : `no grouping matches exactly; closest: ${names(closest)} (${best} mismatching days).`;
}

// For one repo: days where GraphQL (literal date) and REST (grouped in tz) counts differ,
// with the REST commits that fall on each of those days.
function explainRepoMismatch(gqlDays, commits, tz, field) {
  const byDay = new Map();
  for (const c of commits) {
    const d = dayKey(c[field], tz);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(c);
  }
  const days = [...new Set([...gqlDays.keys(), ...byDay.keys()])].sort();
  const out = [];
  for (const day of days) {
    const g = gqlDays.get(day) ?? 0;
    const list = byDay.get(day) ?? [];
    if (g === list.length) continue;
    out.push({
      day,
      gql: g,
      rest: list.length,
      commits: list.map((c) => ({
        sha7: c.sha.slice(0, 7),
        authorDate: c.authorDate,
        committerDate: c.committerDate,
        coAuthored: c.coAuthored,
      })),
    });
  }
  return out;
}

// ---------- selftest ----------

function selftest() {
  const eq = (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      console.error(`FAIL ${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
      process.exit(1);
    }
    console.log(`ok   ${msg}`);
  };
  eq(dayKey('2026-01-01T20:00:00Z', 'UTC'), '2026-01-01', 'late-night commit, UTC day');
  eq(dayKey('2026-01-01T20:00:00Z', IST), '2026-01-02', 'late-night commit, IST day');
  eq(dayKey('2026-03-10T19:30:00Z', IST), '2026-03-11', 'IST boundary 19:30Z -> 01:00 IST next day');
  eq(addDays('2026-02-28', 1), '2026-03-01', 'addDays across month');
  eq(listDays('2026-01-30', '2026-02-02').length, 4, 'listDays inclusive');

  const m = (...d) => new Map(d.map((x) => [x, 1]));
  eq(streaks(m('2026-05-01', '2026-05-02', '2026-05-03'), '2026-05-03'), { current: 3, longest: 3 }, 'streak ends today');
  eq(streaks(m('2026-05-01', '2026-05-02', '2026-05-03'), '2026-05-04'), { current: 3, longest: 3 }, 'streak ends yesterday');
  eq(streaks(m('2026-05-01', '2026-05-02', '2026-05-03'), '2026-05-05'), { current: 0, longest: 3 }, 'streak broken');
  eq(streaks(m('2026-05-01', '2026-05-03', '2026-05-04'), '2026-05-04'), { current: 2, longest: 2 }, 'gap splits runs');
  eq(streaks(new Map([['2026-05-01', 0]]), '2026-05-01'), { current: 0, longest: 0 }, 'zero count is not active');

  const w = makeWindow(Date.parse('2026-10-13T12:00:00Z'));
  eq((w.to - w.from) / DAY_MS, 364, 'window is 364 days');
  eq(inWindow('2026-10-13T12:00:01Z', w), false, 'after window excluded');
  eq(inWindow('2025-10-15T12:00:00Z', w), true, 'window start included');
  eq(inWindow('2025-10-14T11:59:59Z', w), false, 'before window excluded (widened fetch gets filtered)');

  const d = diffCounts(new Map([['a', 2], ['b', 1]]), new Map([['a', 2], ['b', 3], ['c', 1]]), ['a', 'b', 'c']);
  eq({ n: d.rows.length, abs: d.absDiff }, { n: 2, abs: 3 }, 'diffCounts');

  eq(inspectOccurredAt(['2026-01-01T00:00:00Z']).cleanUtcMidnight, true, 'occurredAt clean midnight');
  eq(inspectOccurredAt(['2026-01-01T00:00:00Z', '2026-01-02T05:30:00Z']).nonMidnight.length, 1, 'occurredAt non-midnight flagged');
  eq(inspectOccurredAt(['2026-01-01T00:00:00+05:30']).cleanUtcMidnight, false, 'occurredAt offset flagged');

  eq(pickRandom(['a', 'b', 'c', 'd'], 2, mulberry32(1)), pickRandom(['a', 'b', 'c', 'd'], 2, mulberry32(1)), 'seeded sample is reproducible');
  eq(nextLink('<https://x/y?page=2>; rel="next", <https://x/y?page=5>; rel="last"'), 'https://x/y?page=2', 'Link header next');
  eq(hasCoAuthor('fix\n\nCo-authored-by: A <a@x>'), true, 'co-authored-by detected');
  eq(hasCoAuthor('fix\n\nco-authored-by: A <a@x>'), true, 'co-authored-by is case-insensitive');
  eq(hasCoAuthor('plain message'), false, 'no co-authored-by');
  eq(hasCoAuthor(undefined), false, 'missing message');

  eq(interiorDays('2026-01-01', '2026-01-10', '2026-01-01', '2026-01-10').length, 8, 'interior days, same bounds');
  eq(interiorDays('2026-01-01', '2026-01-10', '2026-01-02', '2026-01-10')[0], '2026-01-03', 'interior starts after the later start day');
  eq(interiorDays('2026-01-01', '2026-01-09', '2026-01-02', '2026-01-10').at(-1), '2026-01-08', 'interior ends before the earlier end day');

  const r = (label, mismatches) => ({ label, mismatches });
  eq(verdictText([r('A', 0), r('B', 0)]), 'all 2 groupings match the reference.', 'verdict: all match');
  eq(verdictText([r('A', 0), r('B', 3)]), 'matches the reference: A. Does not match: B.', 'verdict: one matches');
  eq(verdictText([r('A', 4), r('B', 4)]), 'no grouping matches; all have 4 mismatching days.', 'verdict: all equally off');
  eq(verdictText([r('A', 4), r('B', 2), r('C', 2)]), 'no grouping matches exactly; closest: B, C (2 mismatching days).', 'verdict: closest ties');

  // 20:00Z on Jan 1 is Jan 2 in IST: GraphQL says Jan 1, REST (IST) says Jan 2.
  const fake = [
    { sha: 'abcdef1234', authorDate: '2026-01-01T20:00:00Z', committerDate: '2026-01-02T08:00:00Z', coAuthored: true },
    { sha: '1234567abc', authorDate: '2026-01-05T06:00:00Z', committerDate: '2026-01-05T06:00:00Z', coAuthored: false },
  ];
  const ex = explainRepoMismatch(new Map([['2026-01-01', 1], ['2026-01-05', 1]]), fake, IST, 'authorDate');
  eq(ex.map((x) => [x.day, x.gql, x.rest]), [['2026-01-01', 1, 0], ['2026-01-02', 0, 1]], 'repo mismatch days (IST)');
  eq(ex[1].commits, [{ sha7: 'abcdef1', authorDate: '2026-01-01T20:00:00Z', committerDate: '2026-01-02T08:00:00Z', coAuthored: true }], 'repo mismatch commit details');
  eq(explainRepoMismatch(new Map([['2026-01-01', 1], ['2026-01-05', 1]]), fake, 'UTC', 'authorDate'), [], 'no mismatch in UTC grouping');
  console.log('\nselftest passed');
}

if (hasFlag('--selftest')) {
  selftest();
  process.exit(0);
}

// ---------- config ----------

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GITHUB_USERNAME;
const WORK_ORG = process.env.WORK_ORG;
const missing = ['GITHUB_TOKEN', 'GITHUB_USERNAME', 'WORK_ORG'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}. Run: node --env-file=.env.local spike/spike.mjs`);
  process.exit(1);
}
const isWork = (owner) => owner.toLowerCase() === WORK_ORG.toLowerCase();
const tag = (owner) => (isWork(owner) ? '[WORK]' : '');

const warnings = [];
let minRateRemaining = Infinity;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'User-Agent': 'gittrack-spike',
  Accept: 'application/vnd.github+json',
};

function noteRate(res) {
  const r = Number(res.headers.get('x-ratelimit-remaining'));
  if (Number.isFinite(r)) minRateRemaining = Math.min(minRateRemaining, r);
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  noteRate(res);
  if (res.status === 401) die('GitHub returned 401: token is invalid or expired.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !body.data) die(`GraphQL HTTP ${res.status}: ${body.message ?? 'no message'}`);
  if (body.errors?.length) {
    const msgs = body.errors.map((e) => e.message);
    if (!body.data?.user) die(`GraphQL errors: ${msgs.join(' | ')}`);
    warnings.push(`GraphQL returned partial data: ${msgs.join(' | ')}`);
  }
  if (!body.data?.user) die(`GraphQL: user "${USER}" not found.`);
  return body.data.user.contributionsCollection;
}

const MAIN_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      restrictedContributionsCount
      hasAnyRestrictedContributions
      contributionCalendar { totalContributions }
      commitContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner isFork isPrivate owner { login } defaultBranchRef { name } }
        contributions(first: 100) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { occurredAt commitCount }
        }
      }
      pullRequestContributions(first: 100) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { pullRequest { number createdAt mergedAt state repository { nameWithOwner owner { login } } } }
      }
    }
  }
}`;

const PR_PAGE_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!, $after: String!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      pullRequestContributions(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { pullRequest { number createdAt mergedAt state repository { nameWithOwner owner { login } } } }
      }
    }
  }
}`;

// Cursors are per connection, so the other repos in the result are ignored.
const REPO_PAGE_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!, $after: String!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner }
        contributions(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { occurredAt commitCount }
        }
      }
    }
  }
}`;

async function fetchCommits(repo, sinceIso, untilIso) {
  const params = new URLSearchParams({
    author: USER,
    sha: repo.branch,
    since: sinceIso,
    until: untilIso,
    per_page: '100',
  });
  let url = `https://api.github.com/repos/${repo.nameWithOwner}/commits?${params}`;
  const out = new Map();
  for (let page = 0; url && page < MAX_PAGES * 5; page++) {
    const res = await fetch(url, { headers });
    noteRate(res);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const note = res.status === 409 ? 'empty repo' : (body.message ?? 'no message');
      warnings.push(`REST ${res.status} on ${repo.nameWithOwner}: ${note}${out.size ? ' (partial)' : ''}`);
      break;
    }
    for (const c of await res.json()) {
      out.set(c.sha, {
        sha: c.sha,
        repo: repo.nameWithOwner,
        owner: repo.owner,
        authorDate: c.commit.author?.date,
        committerDate: c.commit.committer?.date,
        coAuthored: hasCoAuthor(c.commit.message),
      });
    }
    url = nextLink(res.headers.get('link'));
  }
  return [...out.values()];
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        results[k] = await fn(items[k]);
      }
    }),
  );
  return results;
}

// ---------- output helpers ----------

const h = (t) => console.log(`\n=== ${t} ===`);
const line = (...a) => console.log(...a);
const p = (v, n) => String(v).padStart(n);

// ---------- main ----------

const tStart = performance.now();
const win = makeWindow(Date.now());
const fromIso = win.from.toISOString();
const toIso = win.to.toISOString();
const firstDay = dayKey(fromIso, 'UTC');
const lastDay = dayKey(toIso, 'UTC');
const allUtcDays = listDays(firstDay, lastDay);
const vars = { login: USER, from: fromIso, to: toIso };

// 1) GraphQL
const tGql0 = performance.now();
const cc = await gql(MAIN_QUERY, vars);

const byRepo = cc.commitContributionsByRepository;
if (byRepo.length >= 100) warnings.push('commitContributionsByRepository hit the 100-repo cap; some repos are missing.');

const repos = [];
for (const entry of byRepo) {
  const r = entry.repository;
  const nodes = [...entry.contributions.nodes];
  let pi = entry.contributions.pageInfo;
  for (let page = 0; pi.hasNextPage && page < MAX_PAGES; page++) {
    const next = await gql(REPO_PAGE_QUERY, { ...vars, after: pi.endCursor });
    const match = next.commitContributionsByRepository.find((e) => e.repository.nameWithOwner === r.nameWithOwner);
    if (!match) {
      warnings.push(`Pagination lost ${r.nameWithOwner}; GraphQL reference is truncated for it.`);
      break;
    }
    nodes.push(...match.contributions.nodes);
    pi = match.contributions.pageInfo;
  }
  if (pi.hasNextPage) warnings.push(`GraphQL reference truncated for ${r.nameWithOwner} (page cap).`);
  repos.push({
    nameWithOwner: r.nameWithOwner,
    owner: r.owner.login,
    isFork: r.isFork,
    isPrivate: r.isPrivate,
    branch: r.defaultBranchRef?.name ?? null,
    nodes,
  });
}

const prNodes = [...cc.pullRequestContributions.nodes];
let prPi = cc.pullRequestContributions.pageInfo;
for (let page = 0; prPi.hasNextPage && page < MAX_PAGES; page++) {
  const next = (await gql(PR_PAGE_QUERY, { ...vars, after: prPi.endCursor })).pullRequestContributions;
  prNodes.push(...next.nodes);
  prPi = next.pageInfo;
}
const tGql = performance.now() - tGql0;

// 2) REST commits
const tRest0 = performance.now();
const sinceIso = new Date(win.from.getTime() - PAD_DAYS * DAY_MS).toISOString();
const untilIso = new Date(win.to.getTime() + PAD_DAYS * DAY_MS).toISOString();
const restRepos = repos.filter((r) => {
  if (r.isFork) {
    warnings.push(`Skipped fork ${r.nameWithOwner} (fork commits don't count per PRD).`);
    return false;
  }
  if (!r.branch) {
    warnings.push(`Skipped ${r.nameWithOwner}: no default branch.`);
    return false;
  }
  return true;
});
const commits = (await pool(restRepos, CONCURRENCY, (r) => fetchCommits(r, sinceIso, untilIso))).flat();
const tRest = performance.now() - tRest0;

// 3) aggregate
const refCounts = new Map();
const rawOccurred = [];
for (const r of repos) {
  for (const n of r.nodes) {
    rawOccurred.push(n.occurredAt);
    const d = n.occurredAt.slice(0, 10); // literal date as GitHub reports it
    refCounts.set(d, (refCounts.get(d) ?? 0) + n.commitCount);
  }
}
const refTotal = [...refCounts.values()].reduce((a, b) => a + b, 0);

const variants = { author: 'authorDate', committer: 'committerDate' };
const agg = {};
for (const [name, field] of Object.entries(variants)) {
  const list = commits.filter((c) => c[field] && inWindow(c[field], win));
  agg[name] = {
    list,
    utc: countBy(list, (c) => dayKey(c[field], 'UTC')),
    ist: countBy(list, (c) => dayKey(c[field], IST)),
  };
}

// 4) print
h('Run');
line(`user: ${USER}   work org: ${WORK_ORG}`);
line(`window: ${fromIso} -> ${toIso} (${WINDOW_DAYS} days)`);
line(`REST fetch widened by ${PAD_DAYS} days each side, then filtered in-script`);
line(`active repos (GraphQL): ${repos.length}, fetched via REST: ${restRepos.length}`);

h('Restricted contributions (checks 3, 4)');
line(`restrictedContributionsCount: ${cc.restrictedContributionsCount}`);
line(`hasAnyRestrictedContributions: ${cc.hasAnyRestrictedContributions}`);
line('(private contributions that GitHub counts but does not detail; shown on the profile only if enabled)');
line(`contributionCalendar.totalContributions (all types, reference only): ${cc.contributionCalendar.totalContributions}`);

h('GraphQL occurredAt inspection (check 1 reference)');
const occ = inspectOccurredAt(rawOccurred);
line(`nodes: ${rawOccurred.length}`);
line('first 5 raw occurredAt values:');
for (const r of occ.first5) line(`  ${r}`);
if (occ.nonMidnight.length) {
  line(`WARNING: ${occ.nonMidnight.length} value(s) have a time part other than 00:00:00Z, e.g.:`);
  for (const r of occ.nonMidnight.slice(0, 5)) line(`  ${r}`);
}
line(
  occ.cleanUtcMidnight
    ? 'Timezone: every value is UTC midnight, so the reference days appear to be UTC calendar days.'
    : 'Timezone: NOT clean UTC-midnight days; the reference timezone is unclear.',
);
line('Reference is grouped by the literal YYYY-MM-DD of occurredAt, with no conversion.');

const todayUtc = dayKey(toIso, 'UTC');
const todayIst = dayKey(toIso, IST);

h('Check 1: daily commits vs GraphQL commits-only reference (UTC and IST groupings)');
const interior = interiorDays(firstDay, lastDay, dayKey(fromIso, IST), todayIst);
line(`compared over ${interior.length} days (partial first and last days of both the UTC and IST windows excluded)`);
line('The reference is always the literal occurredAt date; "IST" rows group REST commits in Asia/Kolkata against it.');
line(`totals: GraphQL ${refTotal} | REST author.date ${agg.author.list.length} | REST committer.date ${agg.committer.list.length}`);
const combos = [
  { label: 'UTC author.date', counts: agg.author.utc },
  { label: 'UTC committer.date', counts: agg.committer.utc },
  { label: 'IST author.date', counts: agg.author.ist },
  { label: 'IST committer.date', counts: agg.committer.ist },
];
const comboResults = [];
for (const { label, counts } of combos) {
  const d = diffCounts(refCounts, counts, interior);
  comboResults.push({ label, mismatches: d.rows.length });
  line(`\n${label} vs reference: ${d.rows.length} mismatching day(s), total abs diff ${d.absDiff}`);
  for (const r of d.rows.slice(0, 15)) line(`  ${r.day}  graphql=${r.ref}  rest=${r.other}`);
  if (d.rows.length > 15) line(`  ... ${d.rows.length - 15} more`);
}
line(`\nVerdict: ${verdictText(comboResults)}`);

h('Check 2: streaks');
const sRef = streaks(refCounts, todayUtc);
const sRefIst = streaks(refCounts, todayIst);
line(`GraphQL reference (literal dates), today=${todayUtc} UTC: current ${sRef.current}, longest ${sRef.longest}`);
line(`GraphQL reference (literal dates), today=${todayIst} IST: current ${sRefIst.current}, longest ${sRefIst.longest}`);
for (const name of Object.keys(variants)) {
  const u = streaks(agg[name].utc, todayUtc);
  const i = streaks(agg[name].ist, todayIst);
  line(`REST ${name}.date  UTC: current ${u.current}, longest ${u.longest}   IST: current ${i.current}, longest ${i.longest}`);
}
line(`today: UTC ${todayUtc}, IST ${todayIst}`);

h('Check 7: commits by repo (REST, author.date)');
const perRepo = countBy(agg.author.list, (c) => c.repo);
const gqlPerRepo = new Map(repos.map((r) => [r.nameWithOwner, r.nodes.reduce((a, n) => a + n.commitCount, 0)]));
const repoRows = repos
  .map((r) => ({ r, rest: perRepo.get(r.nameWithOwner) ?? 0, gql: gqlPerRepo.get(r.nameWithOwner) ?? 0 }))
  .sort((a, b) => b.rest - a.rest);
line(`${p('REST', 6)} ${p('GQL', 6)}  repo`);
for (const { r, rest, gql: g } of repoRows) {
  line(`${p(rest, 6)} ${p(g, 6)}  ${r.nameWithOwner} ${tag(r.owner)}${r.isPrivate ? ' (private)' : ''}${r.isFork ? ' (fork, skipped)' : ''}`);
}
const sumRepo = repoRows.reduce((a, x) => a + x.rest, 0);
const sumDays = [...agg.author.utc.values()].reduce((a, b) => a + b, 0);
line(`sum by repo ${sumRepo} | sum by UTC day ${sumDays} | total ${agg.author.list.length} -> ${sumRepo === sumDays && sumDays === agg.author.list.length ? 'consistent' : 'MISMATCH'}`);
const workRest = repoRows.filter((x) => isWork(x.r.owner)).reduce((a, x) => a + x.rest, 0);
line(`work commits ${workRest}, personal commits ${sumRepo - workRest}`);

h('Check 7b: repos where GraphQL and REST totals differ (REST grouped in IST, author.date)');
const MAX_DIFF_DAYS = 15;
const mismatched = repoRows.filter((x) => x.rest !== x.gql);
if (!mismatched.length) line('none: per-repo totals agree.');
for (const { r, rest, gql: g } of mismatched) {
  const gqlDays = new Map();
  for (const n of r.nodes) gqlDays.set(n.occurredAt.slice(0, 10), (gqlDays.get(n.occurredAt.slice(0, 10)) ?? 0) + n.commitCount);
  const repoCommits = agg.author.list.filter((c) => c.repo === r.nameWithOwner);
  const days = explainRepoMismatch(gqlDays, repoCommits, IST, 'authorDate');
  line(`\n${r.nameWithOwner} ${tag(r.owner)}  REST ${rest} vs GraphQL ${g}  (${days.length} differing IST day(s))`);
  for (const d of days.slice(0, MAX_DIFF_DAYS)) {
    line(`  ${d.day}  graphql=${d.gql}  rest-ist=${d.rest}`);
    if (!d.commits.length) line('    (no REST commits on this IST day)');
    for (const c of d.commits) {
      line(`    ${c.sha7}  author ${c.authorDate}  committer ${c.committerDate}  co-authored-by: ${c.coAuthored ? 'yes' : 'no'}`);
    }
  }
  if (days.length > MAX_DIFF_DAYS) line(`  ... ${days.length - MAX_DIFF_DAYS} more day(s)`);
}

h('Check 6: pull requests');
const prs = prNodes.map((n) => n.pullRequest);
const opened = prs.filter((x) => inWindow(x.createdAt, win));
const merged = prs.filter((x) => x.mergedAt && inWindow(x.mergedAt, win));
const openNow = prs.filter((x) => x.state === 'OPEN');
const split = (arr) => `${arr.length} (work ${arr.filter((x) => isWork(x.repository.owner.login)).length}, personal ${arr.filter((x) => !isWork(x.repository.owner.login)).length})`;
line(`opened in window: ${split(opened)}`);
line(`merged in window (of those opened in window): ${split(merged)}`);
line(`open now: ${split(openNow)}`);
line('Compare with GitHub PR search (paste into the PRs search bar):');
line(`  is:pr author:${USER} created:${firstDay}..${lastDay}`);
line(`  is:pr author:${USER} is:merged merged:${firstDay}..${lastDay}`);
line('Note: search also counts PRs in repos you do not belong to, and merged PRs opened before the window; this script does not.');

h('Check 8: UTC vs IST regrouping (author.date)');
const shifted = agg.author.list.filter((c) => dayKey(c.authorDate, 'UTC') !== dayKey(c.authorDate, IST));
line(`${shifted.length} of ${agg.author.list.length} commits fall on a different day in UTC vs ${IST}`);
for (const c of shifted.slice(0, 10)) {
  line(`  ${c.sha.slice(0, 7)} ${c.authorDate}  UTC ${dayKey(c.authorDate, 'UTC')}  IST ${dayKey(c.authorDate, IST)} ${tag(c.owner)}`);
}

if (hasFlag('--full')) {
  h('Per-day table');
  const days = [...new Set([...allUtcDays, ...listDays(dayKey(fromIso, IST), todayIst)])].sort();
  line('date        graphql  utc-auth  utc-comm  ist-auth  ist-comm');
  for (const d of days) {
    const g = (m) => p(m.get(d) ?? 0, 8);
    line(`${d} ${g(refCounts)}  ${g(agg.author.utc)}  ${g(agg.committer.utc)}  ${g(agg.author.ist)}  ${g(agg.committer.ist)}`);
  }
}

if (opt('--sample')) {
  const n = Number(opt('--sample'));
  const seed = opt('--seed') !== undefined ? Number(opt('--seed')) : Date.now() % 1_000_000_000;
  h(`Sample of ${n} days (all days in window, zeros included), seed ${seed}`);
  line('Compare the graphql / utc columns with your GitHub profile graph.');
  line('date        day  graphql  utc-auth  utc-comm');
  for (const d of pickRandom(allUtcDays, n, mulberry32(seed))) {
    const wd = new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    line(`${d}  ${wd}  ${p(refCounts.get(d) ?? 0, 7)}  ${p(agg.author.utc.get(d) ?? 0, 8)}  ${p(agg.committer.utc.get(d) ?? 0, 8)}`);
  }
}

const total = performance.now() - tStart;
h('Check 9: timing');
line(`GraphQL ${(tGql / 1000).toFixed(2)}s | REST ${(tRest / 1000).toFixed(2)}s | total ${(total / 1000).toFixed(2)}s`);
line(`guideline: total <= ${SPEED_HINT_MS / 1000}s -> ${total <= SPEED_HINT_MS ? 'within guideline' : 'over guideline'}`);
line(`lowest x-ratelimit-remaining seen: ${Number.isFinite(minRateRemaining) ? minRateRemaining : 'n/a'}`);

h('Warnings');
if (warnings.length) for (const w of warnings) line(`- ${w}`);
else line('none');
