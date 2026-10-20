import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, config as appConfig, sessionUser } from "@/backend";

// Paths anyone may load: the login page and its sign-in routes, the probe, and what the browser fetches for the
// installed app (manifest, icons, service worker, offline page). Everything else needs a session.
const PUBLIC = /^\/(login|health|logout|offline|manifest\.webmanifest|sw\.js|favicon\.ico|icon[\w.-]*|apple-icon[\w.-]*)$|^\/api\//;

// Signed-out page requests go to /login?next=<path>. Other methods pass: server actions and route handlers check the
// session themselves.
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if ((req.method !== "GET" && req.method !== "HEAD") || PUBLIC.test(pathname)) return NextResponse.next();
  if (sessionUser(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/login", appConfig().publicUrl);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: "/((?!_next/).*)",
};
