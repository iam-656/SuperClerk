// ─────────────────────────────────────────────────────────────
// SuperClerk — Middleware
// Protects all /dashboard routes — redirects to / if unauthenticated.
// /dashboard/onboarding is accessible with just a NextAuth session
// (no backend JWT needed — the sync happens on that page mount).
// ─────────────────────────────────────────────────────────────

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: unknown }) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnOnboarding = pathname.startsWith("/dashboard/onboarding");

  // If hitting any dashboard route without a session → sign-in page
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Authenticated user on the landing page → dashboard
  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Allow onboarding to pass through (session already verified above)
  if (isOnOnboarding) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
