import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSessionSecret } from "./lib/sessionSecret";

// Backend API routes that should be proxied directly (via next.config.ts rewrites)
const BACKEND_API_PREFIXES = [
  "/api/musicians",
  "/api/groups",
  "/api/users",
  "/api/auth/sync",
  "/api/event-requests",
  "/api/genres",
  "/api/me",
  "/api/gigs",
];

// Our custom auth API routes handled by Next.js route handlers
const CUSTOM_AUTH_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/token",
  "/api/auth/profile",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Intercept /api/auth/profile to serve user from our custom session
  if (pathname === "/api/auth/profile") {
    try {
      const sessionCookie = request.cookies.get("nitro_session");
      if (!sessionCookie?.value) {
        return NextResponse.json(null, { status: 401 });
      }

      const secret = getSessionSecret();

      const { payload } = await jwtVerify(sessionCookie.value, secret);
      const session = (payload as { session: { user: Record<string, unknown> } }).session;

      return NextResponse.json(session.user);
    } catch {
      return NextResponse.json(null, { status: 401 });
    }
  }

  // Custom auth routes: let Next.js route handlers serve them
  if (CUSTOM_AUTH_ROUTES.some(route => pathname === route)) {
    return NextResponse.next();
  }

  // Backend API routes: pass through to Next.js rewrites → .NET backend
  if (BACKEND_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // All other routes (pages, static assets, etc.): pass through normally
  // We do NOT use auth0.middleware() since we handle auth with our custom session
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
