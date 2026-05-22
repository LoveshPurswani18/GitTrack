/**
 * github.js — GitTrack data fetcher (Phase 1 rewrite)
 *
 * Key fixes vs original:
 *  - Authenticated requests via VITE_GITHUB_TOKEN (raises rate limit 60→5000/hr)
 *  - Full pagination for Events API (up to 10 pages / ~300 events)
 *  - Explicit rate-limit detection — surfaces a clear error instead of silently
 *    returning empty data or falling back to stale mock data
 *  - Correct Accept + API version headers on every request
 */

const BASE_URL = 'https://api.github.com';

// ---------------------------------------------------------------------------
// Build headers — token is optional but strongly recommended.
// Add VITE_GITHUB_TOKEN=ghp_xxx to your .env file.
// Without it you get 60 unauthenticated requests/hour, which is easy to
// exhaust once pagination is enabled.
// ---------------------------------------------------------------------------
function buildHeaders() {
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---------------------------------------------------------------------------
// fetchPage — fetch a single URL, parse rate-limit headers, throw on errors
// ---------------------------------------------------------------------------
async function fetchPage(url) {
  const res = await fetch(url, { headers: buildHeaders() });

  // Expose remaining quota on every response so callers can surface it
  const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '-1', 10);
  const resetEpoch = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10);

  if (res.status === 403 || res.status === 429) {
    const resetAt = new Date(resetEpoch * 1000).toLocaleTimeString();
    throw Object.assign(
      new Error(`GitHub rate limit hit. Resets at ${resetAt}.`),
      { code: 'RATE_LIMIT', resetEpoch, remaining }
    );
  }

  if (res.status === 404) {
    throw Object.assign(new Error('GitHub user not found.'), { code: 'NOT_FOUND' });
  }

  if (!res.ok) {
    throw Object.assign(
      new Error(`GitHub API error ${res.status}`),
      { code: 'HTTP_ERROR', status: res.status }
    );
  }

  const data = await res.json();

  // Parse Link header to detect whether a next page exists
  const link = res.headers.get('Link') ?? '';
  const hasNextPage = link.includes('rel="next"');

  return { data, hasNextPage, remaining, resetEpoch };
}

// ---------------------------------------------------------------------------
// fetchAllPages — paginate through an endpoint, respecting GitHub's hard cap
// of 10 pages on the Events API (300 events total).
// ---------------------------------------------------------------------------
async function fetchAllPages(path, maxPages = 10) {
  const results = [];

  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${BASE_URL}${path}${sep}per_page=100&page=${page}`;

    const { data, hasNextPage } = await fetchPage(url);

    // An empty array or non-array body means we've passed the last page
    if (!Array.isArray(data) || data.length === 0) break;

    results.push(...data);

    if (!hasNextPage) break;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all public push events for a user.
 * GitHub keeps ~90 days of events, max 300 per user (10 pages × 30–100).
 * We fetch all available pages so no commits are silently dropped.
 */
export async function fetchUserEvents(username) {
  return fetchAllPages(`/users/${username}/events`);
}

/**
 * Fetch basic profile info (avatar, bio, public_repos count etc.)
 */
export async function fetchUserProfile(username) {
  const { data } = await fetchPage(`${BASE_URL}/users/${username}`);
  return data;
}

/**
 * Check the current rate-limit status.
 * Useful to show a warning in the UI before hitting the wall.
 * Returns { limit, remaining, reset (epoch seconds), used }
 */
export async function fetchRateLimit() {
  const { data } = await fetchPage(`${BASE_URL}/rate_limit`);
  return data.rate;
}