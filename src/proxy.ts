import { NextResponse, type NextRequest } from "next/server";
import { decideAccess, UNLOCK_PATH } from "@/lib/auth/access";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/cookie";
import { getGate } from "@/lib/auth/gate";

let reportedUnavailable = false;

/**
 * The access gate's first layer: runs before every route except `_next/static` and `_next/image`
 * (see `config.matcher`). The rules live in `decideAccess`. Server actions are POSTs to the page
 * they are used on, so each action and data read checks the session again (`requireSession`).
 */
export function proxy(request: NextRequest) {
  const gate = getGate();
  if (!gate.ready && !reportedUnavailable) {
    reportedUnavailable = true;
    console.error(`[gate] unavailable, every route shows the unavailable screen: ${gate.reason}`);
  }

  const hasSession =
    gate.ready && verifySession(gate.cookieSecret, request.cookies.get(SESSION_COOKIE)?.value);
  const access = decideAccess({
    pathname: request.nextUrl.pathname,
    method: request.method,
    gate,
    hasSession,
  });

  const target = request.nextUrl.clone();
  target.pathname = UNLOCK_PATH;
  target.search = "";

  let response: NextResponse;
  switch (access.kind) {
    case "allow":
      response = NextResponse.next();
      break;
    case "redirect":
      response = NextResponse.redirect(target);
      break;
    case "home":
      target.pathname = "/";
      response = NextResponse.redirect(target);
      break;
    case "unavailable":
      // Next ignores a status set on a rewrite, so the page itself answers 200. Nothing but the
      // generic screen is served; everything that is not a page read gets a real 503 below.
      response = NextResponse.rewrite(target);
      break;
    case "deny":
      response = new NextResponse(null, { status: access.status });
      break;
  }
  // Nothing behind the gate may be kept by a browser or a shared cache.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
