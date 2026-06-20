// ─────────────────────────────────────────────────────────────
// SuperClerk — NextAuth Type Augmentation
// Extends Session to include Google access token
// ─────────────────────────────────────────────────────────────

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
  }
}
