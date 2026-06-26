// ─────────────────────────────────────────────────────────────
// SuperClerk — Proxy (Next.js 16+ replacement for middleware)
// Protects all /dashboard routes — redirects to / if unauthenticated.
// /dashboard/onboarding is accessible with just a NextAuth session.
// ─────────────────────────────────────────────────────────────

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: unknown }) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isOnDashboard = pathname.startsWith("/dashboard");

  // If hitting any dashboard route without a session → sign-in page
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Authenticated user on the landing page → dashboard
  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Protect dashboard routes and the landing page only.
    // Explicitly exclude /api/auth/* so NextAuth handlers are never intercepted.
    "/dashboard/:path*",
    "/",
  ],
};
