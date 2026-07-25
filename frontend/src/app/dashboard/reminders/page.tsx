"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Reminders Page
// Uses SWR for stale-while-revalidate caching:
//  • Shows cached reminders instantly on tab-switch
//  • Background-revalidates every 10s
//  • Optimistic removal on Mark Done
//  • Inline Edit modal to update remind_at and note
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Bell, CheckCircle, RefreshCw, AlertCircle, Clock, Pencil, X, Save } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface Reminder {
  id: string;
  email_id: string;
  subject: string;
  note: string | null;
  remind_at: string;
  is_completed: boolean;
  created_at: string;
}

async function fetchReminders(): Promise<Reminder[]> {
  const token = sessionStorage.getItem("sc_access_token");
  if (!token) return [];
  const res = await fetch(`${BACKEND_URL}/api/v1/reminders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch reminders");
  return res.json();
}

// ── Helper: convert ISO string to <input type="datetime-local"> value ──
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  // format: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Edit Modal ──────────────────────────────────────────────────
interface EditModalProps {
  reminder: Reminder;
  onClose: () => void;
  onSave: (id: string, remindAt: string, note: string) => Promise<void>;
}

function EditReminderModal({ reminder, onClose, onSave }: EditModalProps) {
  const [remindAt, setRemindAt] = useState(toDatetimeLocal(reminder.remind_at));
  const [note, setNote] = useState(reminder.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!remindAt) { setError("Please select a date and time."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(reminder.id, remindAt, note);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl p-6 animate-fade-in"
        style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#FFFBEB" }}
            >
              <Pencil size={15} style={{ color: "#D97706" }} />
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
              Edit Reminder
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--color-surface)]"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Subject (read-only context) */}
        <p className="text-xs mb-5 truncate" style={{ color: "var(--color-text-muted)" }}>
          📧 {reminder.subject}
        </p>

        {/* Date/time field */}
        <div className="mb-4">
          <label
            className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: "var(--color-text-muted)" }}
          >
            Date & Time
          </label>
          <input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        {/* Note field */}
        <div className="mb-5">
          <label
            className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: "var(--color-text-muted)" }}
          >
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Add a note for yourself…"
            className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 resize-none"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        {error && (
          <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#DC2626" }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="btn btn-secondary text-sm px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn text-sm px-4 py-2 gap-2 flex items-center"
            style={{ background: "var(--color-primary)", color: "white" }}
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function RemindersPage() {
  const { data: reminders = [], isLoading, error, mutate } = useSWR<Reminder[]>(
    "reminders",
    fetchReminders,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    }
  );

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifSupported, setNotifSupported] = useState(false);
  const notifiedIds = useRef<Set<string>>(new Set());

  // Which reminder is currently being edited
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // ── Request notification permission on mount ──────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifSupported(true);
    setNotifPermission(Notification.permission);
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => setNotifPermission(perm));
    }
  }, []);

  // ── Fire desktop notifications for due reminders ──────────
  useEffect(() => {
    if (notifPermission !== "granted") return;
    const check = () => {
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      for (const r of reminders) {
        if (r.is_completed || notifiedIds.current.has(r.id)) continue;
        const dueMs = new Date(r.remind_at).getTime();
        if (dueMs > now && dueMs - now <= twoMinutes) {
          notifiedIds.current.add(r.id);
          new Notification("⏰ SuperClerk Reminder", {
            body: r.subject + (r.note ? `\n${r.note}` : ""),
            icon: "/favicon.ico",
            tag: r.id,
          });
        } else if (dueMs <= now && dueMs >= now - twoMinutes) {
          notifiedIds.current.add(r.id);
          new Notification("⏰ SuperClerk Reminder (Due Now)", {
            body: r.subject + (r.note ? `\n${r.note}` : ""),
            icon: "/favicon.ico",
            tag: r.id,
          });
        }
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [reminders, notifPermission]);

  // ── Optimistic complete ────────────────────────────────────
  const completeReminder = async (id: string) => {
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) return;
    mutate(
      (prev) => (prev ?? []).filter((r) => r.id !== id),
      { revalidate: false }
    );
    try {
      await fetch(`${BACKEND_URL}/api/v1/reminders/${id}/complete`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      mutate();
    } catch {
      mutate();
    }
  };

  // ── Edit save handler ──────────────────────────────────────
  const saveEditReminder = async (id: string, remindAtLocal: string, note: string) => {
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) throw new Error("Not authenticated.");

    // Convert datetime-local string to ISO with timezone
    const remindAtISO = new Date(remindAtLocal).toISOString();

    // Optimistic update in SWR cache
    mutate(
      (prev) =>
        (prev ?? []).map((r) =>
          r.id === id ? { ...r, remind_at: remindAtISO, note: note || null } : r
        ),
      { revalidate: false }
    );

    const res = await fetch(`${BACKEND_URL}/api/v1/reminders/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ remind_at: remindAtISO, note: note || null }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      mutate(); // restore on error
      throw new Error(detail?.detail ?? `Server error ${res.status}`);
    }
    mutate(); // sync final state
  };

  return (
    <div className="p-8 max-w-3xl mx-auto h-full flex flex-col">
      {/* ── Header ──────────────────────────────────── */}
      <div className="mb-8 animate-fade-in-up opacity-0 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: "var(--color-text)" }}
            >
              <Bell size={24} style={{ color: "#D97706" }} />
              Active Reminders
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              Keep track of emails that need your attention later.
            </p>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="btn btn-secondary text-sm py-2 px-3 gap-2"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        {/* Notification permission status */}
        {notifSupported && (
          <div className="mt-3">
            {notifPermission === "granted" ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                Desktop notifications enabled
              </div>
            ) : notifPermission === "denied" ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
                🔕 Notifications blocked — enable in browser settings
              </div>
            ) : (
              <button
                onClick={() => Notification.requestPermission().then((p) => setNotifPermission(p))}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#D97706" }}
              >
                🔔 Enable desktop notifications for reminders
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 flex-shrink-0"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
        >
          <AlertCircle size={16} />
          {error instanceof Error ? error.message : "Error fetching reminders"}
        </div>
      )}

      {/* ── Reminders List ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-8">
        {isLoading && reminders.length === 0 ? (
          <div className="flex justify-center py-20">
            <RefreshCw size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
          </div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <Bell size={48} className="mx-auto mb-4" style={{ color: "var(--color-text-muted)", opacity: 0.3 }} />
            <p className="font-medium" style={{ color: "var(--color-text)" }}>
              No active reminders!
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              When you set a reminder on an email, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reminders.map((reminder, index) => {
              const dateObj = new Date(reminder.remind_at);
              const isPast = dateObj.getTime() < Date.now();
              const delayClass = `delay-${(index + 1) * 100}`;

              return (
                <div
                  key={reminder.id}
                  className={`card p-5 animate-fade-in-up opacity-0 ${delayClass} flex items-start gap-4`}
                  style={{
                    borderLeft: isPast ? "3px solid #DC2626" : "3px solid #D97706",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={14} style={{ color: isPast ? "#DC2626" : "#D97706" }} />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: isPast ? "#DC2626" : "#D97706" }}
                      >
                        {isPast ? "Overdue" : "Upcoming"} · {dateObj.toLocaleString()}
                      </span>
                    </div>
                    <p className="font-medium text-sm mb-2" style={{ color: "var(--color-text)" }}>
                      {reminder.subject}
                    </p>
                    {reminder.note && (
                      <div
                        className="text-sm px-3 py-2 rounded-lg"
                        style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
                      >
                        {reminder.note}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* Edit */}
                    <button
                      onClick={() => setEditingReminder(reminder)}
                      className="btn flex-shrink-0 px-3 py-2 text-sm gap-2 transition-all hover:bg-amber-50"
                      style={{ border: "1px solid #FDE68A", color: "#D97706" }}
                      title="Edit reminder"
                      aria-label="Edit reminder"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    {/* Mark Done */}
                    <button
                      onClick={() => completeReminder(reminder.id)}
                      className="btn flex-shrink-0 px-3 py-2 text-sm gap-2 transition-all hover:bg-green-50"
                      style={{ border: "1px solid #D1D5DB", color: "#374151" }}
                      title="Mark as completed"
                    >
                      <CheckCircle size={14} className="text-green-600" />
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Modal ──────────────────────────────── */}
      {editingReminder && (
        <EditReminderModal
          reminder={editingReminder}
          onClose={() => setEditingReminder(null)}
          onSave={saveEditReminder}
        />
      )}
    </div>
  );
}
