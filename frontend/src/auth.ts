// ─────────────────────────────────────────────────────────────
// SuperClerk — NextAuth v5 Configuration
// Google OAuth provider with Gmail scopes for future use
// ─────────────────────────────────────────────────────────────

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    googleId?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Gmail, Tasks, and Calendar scopes for agentic workflows
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/tasks",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async jwt({ token, account }) {
      // Persist Google access/refresh tokens for Gmail API calls
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at; // unix seconds
        token.googleId = account.providerAccountId; // Google sub claim
      }
      return token;
    },
    async session({ session, token }) {
      // Expose tokens and Google ID to client-side hooks
      session.accessToken = token.accessToken as string | undefined;
      session.refreshToken = token.refreshToken as string | undefined;
      session.accessTokenExpires = token.accessTokenExpires as number | undefined;
      // Map Google sub → session.user.id so useAuthSync can send it as google_id
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
