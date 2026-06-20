// ─────────────────────────────────────────────────────────────
// SuperClerk — NextAuth v5 Configuration
// Google OAuth provider with Gmail scopes for future use
// ─────────────────────────────────────────────────────────────

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Gmail scopes upfront for Phase 3 Gmail integration
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
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
      }
      return token;
    },
    async session({ session, token }) {
      // Expose tokens to server-side API calls
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
});
