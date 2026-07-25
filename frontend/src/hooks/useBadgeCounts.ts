// ─────────────────────────────────────────────────────────────
// SuperClerk — useBadgeCounts Hook
// Polls the backend every 30s for live sidebar badge counts:
//   inbox     → unread email count
//   approvals → pending AI draft count
//   reminders → active (non-completed) reminder count
//
// Also exposes `decrementInbox()` so the inbox page can drop
// the badge instantly when an email is marked read — no waiting
// for the next 30-second poll.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const POLL_INTERVAL_MS = 30_000;

export interface BadgeCounts {
  inbox: number;
  approvals: number;
  reminders: number;
}

export interface BadgeCountsApi extends BadgeCounts {
  decrementInbox: () => void;
  refresh: () => void;
}

async function fetchCounts(token: string): Promise<BadgeCounts> {
  const [emailsRes, suggestionsRes, remindersRes] = await Promise.allSettled([
    fetch(`${BACKEND_URL}/api/v1/emails?page=1&page_size=1&unread_only=true`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${BACKEND_URL}/api/v1/analysis/suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${BACKEND_URL}/api/v1/reminders`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  let inbox = 0;
  let approvals = 0;
  let reminders = 0;

  if (emailsRes.status === "fulfilled" && emailsRes.value.ok) {
    const data = await emailsRes.value.json();
    inbox = data.total ?? 0;
  }

  if (suggestionsRes.status === "fulfilled" && suggestionsRes.value.ok) {
    const data = await suggestionsRes.value.json();
    approvals = (data.results ?? []).filter(
      (s: { action: string; approval_status: string }) =>
        s.action === "reply" && s.approval_status === "pending"
    ).length;
  }

  if (remindersRes.status === "fulfilled" && remindersRes.value.ok) {
    const data = await remindersRes.value.json();
    reminders = (data as { is_completed: boolean }[]).filter(
      (r) => !r.is_completed
    ).length;
  }

  return { inbox, approvals, reminders };
}

export function useBadgeCounts(): BadgeCountsApi {
  const [counts, setCounts] = useState<BadgeCounts>({
    inbox: 0,
    approvals: 0,
    reminders: 0,
  });

  const refresh = useCallback(async () => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("sc_access_token")
        : null;
    if (!token) return;
    try {
      const next = await fetchCounts(token);
      setCounts(next);
    } catch {
      // non-fatal — keep previous counts
    }
  }, []);

  // Optimistic decrement — called immediately when user opens an unread email
  const decrementInbox = useCallback(() => {
    setCounts((prev) => ({
      ...prev,
      inbox: Math.max(0, prev.inbox - 1),
    }));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...counts, decrementInbox, refresh };
}
