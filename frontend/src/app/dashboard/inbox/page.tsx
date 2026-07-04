"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Inbox Page (Phase 5: Real Gmail Data)
// Displays emails fetched from Gmail via FastAPI backend.
// 15-min auto-refresh + manual Refresh button.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Mail,
  MailOpen,
  AlertCircle,
  Inbox,
  Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface Email {
  id: string;
  gmail_id: string;
  sender: string;
  sender_name: string | null;
  subject: string;
  snippet: string | null;
  is_read: boolean;
  labels: string[] | null;
  received_at: string;
}

interface SyncResult {
  inserted: number;
  skipped: number;
  new_messages_found?: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getSenderInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  return email[0].toUpperCase();
}

// ─── Component ───────────────────────────────────────────────

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

  // ─── Fetch stored emails from backend ──────────────────────
  const fetchEmails = useCallback(async () => {
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) return;
    try {
      const res = await fetch(
        `${backendUrl}/api/v1/emails?page=1&page_size=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEmails(data.items ?? []);
    } catch {
      setError("Failed to load emails. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  // ─── Sync (manual + auto) ──────────────────────────────────
  const triggerSync = useCallback(
    async (silent = false) => {
      const token = sessionStorage.getItem("sc_access_token");
      if (!token) return;
      if (!silent) setSyncing(true);
      setError(null);
      try {
        const res = await fetch(`${backendUrl}/api/v1/emails/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        setSyncResult(result);
        setLastSynced(new Date());
        await fetchEmails();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Sync failed";
        if (!silent) setError(msg);
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [backendUrl, fetchEmails]
  );

  // ─── On mount: load stored emails ─────────────────────────
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // ─── Auto-refresh every 15 minutes ────────────────────────
  useEffect(() => {
    const interval = setInterval(() => triggerSync(true), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [triggerSync]);

  const unreadCount = emails.filter((e) => !e.is_read).length;
  const selectedEmail = emails.find((e) => e.id === selectedId);

  return (
    <div className="flex h-full" style={{ background: "var(--color-bg)" }}>
      {/* ── Left panel: email list ─────────────────────────── */}
      <div
        className="flex flex-col w-[420px] flex-shrink-0 border-r h-full"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <Inbox size={20} style={{ color: "var(--color-primary)" }} />
            <div>
              <h1
                className="text-base font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                Inbox
              </h1>
              {unreadCount > 0 && (
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastSynced && (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Clock size={11} />
                {formatRelativeTime(lastSynced.toISOString())}
              </span>
            )}
            <button
              id="btn-sync-emails"
              onClick={() => triggerSync(false)}
              disabled={syncing}
              className="btn btn-secondary text-xs py-1.5 px-3 gap-1.5"
              aria-label="Refresh inbox"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Sync result banner */}
        {syncResult && syncResult.inserted > 0 && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium"
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              color: "#15803D",
            }}
          >
            ✓ {syncResult.inserted} new email
            {syncResult.inserted !== 1 ? "s" : ""} synced
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
            }}
          >
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl p-4"
                  style={{ background: "var(--color-surface)" }}
                >
                  <div
                    className="h-3 rounded w-1/3 mb-2"
                    style={{ background: "var(--color-border)" }}
                  />
                  <div
                    className="h-3 rounded w-2/3 mb-2"
                    style={{ background: "var(--color-border)" }}
                  />
                  <div
                    className="h-2.5 rounded w-full"
                    style={{ background: "var(--color-border)" }}
                  />
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <Mail
                size={40}
                style={{ color: "var(--color-text-muted)", opacity: 0.4 }}
              />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                No emails yet
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)", opacity: 0.7 }}
              >
                Click Refresh to sync your Gmail inbox
              </p>
            </div>
          ) : (
            <div
              className="divide-y"
              style={{ borderColor: "var(--color-border)" }}
            >
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedId(email.id)}
                  className="w-full text-left px-4 py-3.5 transition-colors hover:bg-[var(--color-surface)] focus:outline-none"
                  style={{
                    background:
                      selectedId === email.id
                        ? "var(--color-surface)"
                        : "transparent",
                    borderLeft:
                      selectedId === email.id
                        ? "3px solid var(--color-primary)"
                        : "3px solid transparent",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Sender avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                      style={{
                        background: `hsl(${(email.sender.charCodeAt(0) * 37) % 360}, 60%, 55%)`,
                      }}
                    >
                      {getSenderInitials(email.sender_name, email.sender)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p
                          className="text-sm truncate"
                          style={{
                            color: "var(--color-text)",
                            fontWeight: email.is_read ? 400 : 600,
                          }}
                        >
                          {email.sender_name ?? email.sender}
                        </p>
                        <span
                          className="text-xs flex-shrink-0"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {formatRelativeTime(email.received_at)}
                        </span>
                      </div>
                      <p
                        className="text-xs mb-1 truncate"
                        style={{
                          color: "var(--color-text)",
                          fontWeight: email.is_read ? 400 : 500,
                        }}
                      >
                        {email.subject}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {email.snippet ?? ""}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!email.is_read && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                        style={{ background: "var(--color-primary)" }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: email detail ──────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmail ? (
          <div className="flex flex-col h-full">
            <div
              className="px-8 py-6 border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <h2
                className="text-xl font-semibold mb-3"
                style={{ color: "var(--color-text)" }}
              >
                {selectedEmail.subject}
              </h2>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{
                    background: `hsl(${(selectedEmail.sender.charCodeAt(0) * 37) % 360}, 60%, 55%)`,
                  }}
                >
                  {getSenderInitials(
                    selectedEmail.sender_name,
                    selectedEmail.sender
                  )}
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    {selectedEmail.sender_name ?? selectedEmail.sender}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {selectedEmail.sender} ·{" "}
                    {new Date(selectedEmail.received_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--color-text)" }}
              >
                {selectedEmail.snippet ?? "No preview available."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MailOpen
              size={48}
              style={{ color: "var(--color-text-muted)", opacity: 0.3 }}
            />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Select an email to read
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
