export type FakeRequest = {
  url: string;
  method: string;
  headers: Headers;
  body: string | undefined;
};

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

/** A stand-in for `fetch` that records requests and how many ran at the same time. */
export function createFakeFetch(handler: (request: FakeRequest) => Response | Promise<Response>) {
  const requests: FakeRequest[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request: FakeRequest = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    requests.push(request);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1)); // let concurrent calls overlap
      return await handler(request);
    } finally {
      inFlight--;
    }
  }) as typeof fetch;

  return { fetch: fakeFetch, requests, maxInFlight: () => maxInFlight };
}
