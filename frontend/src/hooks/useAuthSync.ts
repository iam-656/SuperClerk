// ─────────────────────────────────────────────────────────────
// SuperClerk — useAuthSync Hook
// Fires once after NextAuth session is established.
// Persists the Google-authenticated user to the FastAPI backend,
// stores the returned JWT, and detects first-time sign-ins.
// ─────────────────────────────────────────────────────────────

"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const AGENT_SECRET = process.env.NEXT_PUBLIC_AGENT_SECRET ?? "";
const TOKEN_KEY = "sc_access_token";

export type SyncState = "idle" | "syncing" | "synced" | "error";

export function useAuthSync() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasSynced = useRef(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");

  useEffect(() => {
    // Only run when NextAuth session is authenticated + not already synced
    if (status !== "authenticated" || !session?.user || hasSynced.current) return;

    // If we already have a stored token this session, skip
    if (typeof window !== "undefined" && sessionStorage.getItem(TOKEN_KEY)) {
      hasSynced.current = true;
      setSyncState("synced");
      return;
    }

    hasSynced.current = true;
    setSyncState("syncing");

    const sess = session as {
      accessToken?: string;
      refreshToken?: string;
      accessTokenExpires?: number;
    } & typeof session;
    const { user } = session;

    const doSync = async () => {
      let res: Response;
      try {
        res = await fetch(`${BACKEND_URL}/api/v1/auth/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Agent-Secret": AGENT_SECRET,
          },
          body: JSON.stringify({
            google_id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.image ?? null,
            access_token: sess.accessToken ?? null,
            refresh_token: sess.refreshToken ?? null,
            scopes: [
              "https://www.googleapis.com/auth/gmail.readonly",
              "https://www.googleapis.com/auth/gmail.send",
            ],
            token_expires_at: sess.accessTokenExpires
              ? new Date(sess.accessTokenExpires * 1000).toISOString()
              : null,
          }),
        });
      } catch (networkErr) {
        console.error("[useAuthSync] Network error — is the backend running?", networkErr);
        setSyncState("error");
        hasSynced.current = false; // allow retry on next render
        return;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[useAuthSync] Sync failed: HTTP ${res.status}`, body);
        setSyncState("error");
        hasSynced.current = false; // allow retry
        return;
      }

      const data: { access_token: string; is_new_user: boolean } = await res.json();
      // Store JWT for subsequent API calls
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      setSyncState("synced");

      // First-time users → onboarding, returning users → stay on dashboard
      if (data.is_new_user) {
        router.push("/dashboard/onboarding");
      }
    };

    doSync();
  }, [session, status, router]);

  return syncState;
}

/** Helper to retrieve the stored JWT for API calls */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}
