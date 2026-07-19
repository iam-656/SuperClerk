"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Inbox Page (Phase 6: AI-Powered Analysis)
// Gmail integration + Gemini AI suggestions (reply / reminder)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Mail,
  MailOpen,
  AlertCircle,
  Inbox,
  Clock,
  Sparkles,
  Send,
  Bell,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface Email {
  id: string;
  gmail_id: string;
  sender: string;
  sender_name: string | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  is_read: boolean;
  labels: string[] | null;
  received_at: string;
}

interface Suggestion {
  email_id: string;
  subject: string;
  sender: string;
  summary: string;
  action: "reply" | "reminder";
  reply_draft: string | null;
  reminder_reason: string | null;
  priority: number;
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

function priorityLabel(p: number): { label: string; color: string; bg: string } {
  if (p === 1) return { label: "Urgent", color: "#DC2626", bg: "#FEF2F2" };
  if (p === 2) return { label: "High", color: "#D97706", bg: "#FFFBEB" };
  if (p === 3) return { label: "Medium", color: "#2563EB", bg: "#EFF6FF" };
  return { label: "Low", color: "#6B7280", bg: "#F9FAFB" };
}

// ─── Component ───────────────────────────────────────────────

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // AI suggestion state
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [showSuggestion, setShowSuggestion] = useState(true);

  // Reply modal state
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  // Reminder modal state
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

  // ─── Fetch stored emails ────────────────────────────────────
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

  // ─── Load saved suggestions ────────────────────────────────
  const fetchSuggestions = useCallback(async () => {
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) return;
    try {
      const res = await fetch(`${backendUrl}/api/v1/analysis/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, Suggestion> = {};
      for (const s of data.results ?? []) {
        map[s.email_id] = s;
      }
      setSuggestions(map);
    } catch {
      // non-fatal — suggestions are a bonus
    }
  }, [backendUrl]);

  // ─── Sync ──────────────────────────────────────────────────
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
        if (!res.ok) {
          let detail = `Sync failed (HTTP ${res.status})`;
          try {
            const errBody = await res.json();
            if (errBody.detail) detail = errBody.detail;
          } catch { /* ignore */ }
          throw new Error(detail);
        }
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

  // ─── Analyze inbox with Gemini ─────────────────────────────
  const analyzeInbox = useCallback(async () => {
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) return;
    setAnalysing(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/v1/analysis/analyze-inbox`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail ?? `Analysis failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      const map: Record<string, Suggestion> = { ...suggestions };
      for (const s of data.results ?? []) {
        map[s.email_id] = s;
      }
      setSuggestions(map);
      setSuccessMsg(
        `✨ Analysed ${data.analysed} email${data.analysed !== 1 ? "s" : ""}`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAnalysing(false);
    }
  }, [backendUrl, suggestions]);

  // ─── Send reply ────────────────────────────────────────────
  const sendReply = useCallback(async () => {
    if (!selectedId || !replyBody.trim()) return;
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) return;
    setSending(true);
    try {
      const res = await fetch(
        `${backendUrl}/api/v1/analysis/reply/${selectedId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reply_body: replyBody }),
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail ?? "Failed to send reply");
      }
      setReplyOpen(false);
      setReplyBody("");
      setSuccessMsg("✓ Reply sent successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }, [backendUrl, selectedId, replyBody]);

  // ─── Save reminder locally ─────────────────────────────────
  const saveReminder = useCallback(() => {
    if (!selectedId || !reminderDate) return;
    const reminders = JSON.parse(localStorage.getItem("sc_reminders") ?? "[]");
    reminders.push({
      email_id: selectedId,
      subject: selectedEmail?.subject ?? "",
      date: reminderDate,
      note: reminderNote,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem("sc_reminders", JSON.stringify(reminders));
    setReminderOpen(false);
    setReminderDate("");
    setReminderNote("");
    setSuccessMsg("⏰ Reminder saved!");
    setTimeout(() => setSuccessMsg(null), 3000);
  }, [selectedId, reminderDate, reminderNote]);

  // ─── Mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetchEmails();
    fetchSuggestions();
  }, [fetchEmails, fetchSuggestions]);

  useEffect(() => {
    const interval = setInterval(() => triggerSync(true), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [triggerSync]);

  // Open reply modal pre-filled with draft
  useEffect(() => {
    if (replyOpen && selectedId && suggestions[selectedId]?.reply_draft) {
      setReplyBody(suggestions[selectedId].reply_draft ?? "");
    }
  }, [replyOpen, selectedId, suggestions]);

  // Open reminder modal pre-filled with reason
  useEffect(() => {
    if (reminderOpen && selectedId && suggestions[selectedId]?.reminder_reason) {
      setReminderNote(suggestions[selectedId].reminder_reason ?? "");
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setReminderDate(tomorrow.toISOString().slice(0, 16));
    }
  }, [reminderOpen, selectedId, suggestions]);

  const unreadCount = emails.filter((e) => !e.is_read).length;
  const selectedEmail = emails.find((e) => e.id === selectedId);
  const selectedSuggestion = selectedId ? suggestions[selectedId] : null;

  // ─── Render ────────────────────────────────────────────────

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
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
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
              id="btn-analyze-inbox"
              onClick={analyzeInbox}
              disabled={analysing || loading}
              className="btn btn-secondary text-xs py-1.5 px-3 gap-1.5"
              aria-label="Analyse inbox with AI"
              title="Analyse unread emails with Gemini AI"
            >
              <Sparkles
                size={13}
                className={analysing ? "animate-pulse" : ""}
                style={{ color: "var(--color-primary)" }}
              />
              {analysing ? "Analysing…" : "Analyse"}
            </button>
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

        {/* Success banner */}
        {successMsg && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}
          >
            {successMsg}
          </div>
        )}

        {/* Sync result banner */}
        {syncResult && syncResult.inserted > 0 && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}
          >
            ✓ {syncResult.inserted} new email{syncResult.inserted !== 1 ? "s" : ""} synced
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
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
                  <div className="h-3 rounded w-1/3 mb-2" style={{ background: "var(--color-border)" }} />
                  <div className="h-3 rounded w-2/3 mb-2" style={{ background: "var(--color-border)" }} />
                  <div className="h-2.5 rounded w-full" style={{ background: "var(--color-border)" }} />
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <Mail size={40} style={{ color: "var(--color-text-muted)", opacity: 0.4 }} />
              <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                No emails yet
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                Click Refresh to sync your Gmail inbox
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {emails.map((email) => {
                const hasSuggestion = !!suggestions[email.id];
                return (
                  <button
                    key={email.id}
                    onClick={() => {
                      setSelectedId(email.id);
                      setReplyOpen(false);
                      setReminderOpen(false);
                      setShowSuggestion(true);
                    }}
                    className="w-full text-left px-4 py-3.5 transition-colors hover:bg-[var(--color-surface)] focus:outline-none"
                    style={{
                      background: selectedId === email.id ? "var(--color-surface)" : "transparent",
                      borderLeft:
                        selectedId === email.id
                          ? "3px solid var(--color-primary)"
                          : "3px solid transparent",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 relative"
                        style={{
                          background: `hsl(${(email.sender.charCodeAt(0) * 37) % 360}, 60%, 55%)`,
                        }}
                      >
                        {getSenderInitials(email.sender_name, email.sender)}
                        {/* AI badge dot */}
                        {hasSuggestion && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center"
                            style={{ background: "var(--color-primary)" }}
                            title="AI suggestion available"
                          >
                            <Sparkles size={6} className="text-white" />
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p
                            className="text-sm truncate"
                            style={{ color: "var(--color-text)", fontWeight: email.is_read ? 400 : 600 }}
                          >
                            {email.sender_name ?? email.sender}
                          </p>
                          <span className="text-xs flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                            {formatRelativeTime(email.received_at)}
                          </span>
                        </div>
                        <p
                          className="text-xs mb-1 truncate"
                          style={{ color: "var(--color-text)", fontWeight: email.is_read ? 400 : 500 }}
                        >
                          {email.subject}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                          {email.snippet ?? ""}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!email.is_read && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                          style={{ background: "var(--color-primary)" }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: email detail ───────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmail ? (
          <div className="flex flex-col h-full">

            {/* Email header */}
            <div
              className="px-8 py-6 border-b flex-shrink-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                {selectedEmail.subject}
              </h2>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: `hsl(${(selectedEmail.sender.charCodeAt(0) * 37) % 360}, 60%, 55%)` }}
                >
                  {getSenderInitials(selectedEmail.sender_name, selectedEmail.sender)}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    {selectedEmail.sender_name ?? selectedEmail.sender}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {selectedEmail.sender} · {new Date(selectedEmail.received_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Suggestion Card */}
            {selectedSuggestion && (
              <div
                className="mx-6 mt-4 mb-2 rounded-xl border flex-shrink-0 overflow-hidden"
                style={{
                  borderColor: "var(--color-primary)",
                  borderWidth: "1.5px",
                  background: "linear-gradient(135deg, #F5F3FF 0%, #EFF6FF 100%)",
                }}
              >
                {/* Card header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3"
                  onClick={() => setShowSuggestion((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} style={{ color: "var(--color-primary)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
                      AI Suggestion
                    </span>
                    {/* Priority badge */}
                    {(() => {
                      const p = priorityLabel(selectedSuggestion.priority);
                      return (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: p.bg, color: p.color }}
                        >
                          {p.label}
                        </span>
                      );
                    })()}
                    {/* Action badge */}
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: selectedSuggestion.action === "reply" ? "#EDE9FE" : "#FEF9C3",
                        color: selectedSuggestion.action === "reply" ? "#6D28D9" : "#92400E",
                      }}
                    >
                      {selectedSuggestion.action === "reply" ? "✉ Reply" : "⏰ Reminder"}
                    </span>
                  </div>
                  {showSuggestion ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* Card body */}
                {showSuggestion && (
                  <div className="px-4 pb-4">
                    <p className="text-sm mb-4" style={{ color: "var(--color-text)" }}>
                      {selectedSuggestion.summary}
                    </p>

                    <div className="flex gap-2">
                      {selectedSuggestion.action === "reply" ? (
                        <button
                          id="btn-open-reply"
                          onClick={() => setReplyOpen(true)}
                          className="btn btn-primary text-xs py-1.5 px-4 gap-1.5"
                        >
                          <Send size={12} />
                          Reply
                        </button>
                      ) : (
                        <button
                          id="btn-open-reminder"
                          onClick={() => setReminderOpen(true)}
                          className="btn text-xs py-1.5 px-4 gap-1.5"
                          style={{ background: "#FEF9C3", color: "#92400E", border: "1px solid #FDE68A" }}
                        >
                          <Bell size={12} />
                          Set Reminder
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Email body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {selectedEmail.body_html ? (
                <div
                  className="email-content"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                />
              ) : (
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--color-text)" }}
                >
                  {selectedEmail.body_text ?? selectedEmail.snippet ?? "No preview available."}
                </p>
              )}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MailOpen size={48} style={{ color: "var(--color-text-muted)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Select an email to read
            </p>
            {Object.keys(suggestions).length === 0 && !analysing && (
              <button
                onClick={analyzeInbox}
                className="btn btn-primary text-sm mt-2 gap-2"
              >
                <Sparkles size={15} />
                Analyse Inbox with AI
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Reply Modal ────────────────────────────────────── */}
      {replyOpen && selectedEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
            style={{ background: "var(--color-bg)", maxHeight: "85vh" }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div>
                <h3 className="font-semibold" style={{ color: "var(--color-text)" }}>
                  Reply
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  To: {selectedEmail.sender_name ?? selectedEmail.sender} &lt;{selectedEmail.sender}&gt;
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Re: {selectedEmail.subject}
                </p>
              </div>
              <button
                id="btn-close-reply"
                onClick={() => setReplyOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* AI draft notice */}
            {selectedSuggestion?.reply_draft && (
              <div
                className="mx-6 mt-4 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                style={{ background: "#F5F3FF", color: "var(--color-primary)" }}
              >
                <Sparkles size={12} />
                AI-drafted reply — edit freely before sending
              </div>
            )}

            {/* Textarea */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <textarea
                id="reply-textarea"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full h-56 resize-none rounded-xl p-4 text-sm outline-none border focus:border-[var(--color-primary)]"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  borderColor: "var(--color-border)",
                }}
                placeholder="Type your reply here…"
              />
            </div>

            {/* Modal footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: "var(--color-border)" }}
            >
              <button
                onClick={() => setReplyOpen(false)}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                id="btn-send-reply"
                onClick={sendReply}
                disabled={sending || !replyBody.trim()}
                className="btn btn-primary text-sm gap-2"
              >
                {sending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Reply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reminder Modal ─────────────────────────────────── */}
      {reminderOpen && selectedEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl"
            style={{ background: "var(--color-bg)" }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center gap-2">
                <Bell size={16} style={{ color: "#D97706" }} />
                <h3 className="font-semibold" style={{ color: "var(--color-text)" }}>
                  Set Reminder
                </h3>
              </div>
              <button onClick={() => setReminderOpen(false)}>
                <X size={20} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-4 flex flex-col gap-4">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--color-text)" }}>
                  {selectedEmail.subject}
                </span>
              </p>

              {selectedSuggestion?.reminder_reason && (
                <div
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{ background: "#FEF9C3", color: "#92400E" }}
                >
                  💡 {selectedSuggestion.reminder_reason}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Remind me at
                </label>
                <input
                  id="reminder-datetime"
                  type="datetime-local"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[var(--color-primary)]"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Note (optional)
                </label>
                <textarea
                  id="reminder-note"
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none focus:border-[var(--color-primary)]"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  placeholder="What do you need to do?"
                />
              </div>
            </div>

            <div
              className="flex justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: "var(--color-border)" }}
            >
              <button onClick={() => setReminderOpen(false)} className="btn btn-secondary text-sm">
                Cancel
              </button>
              <button
                id="btn-save-reminder"
                onClick={saveReminder}
                disabled={!reminderDate}
                className="btn text-sm gap-2"
                style={{ background: "#FEF9C3", color: "#92400E", border: "1px solid #FDE68A" }}
              >
                <CheckCircle size={14} />
                Save Reminder
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
