"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Approval Card Component
// Fix 4: "Approve & Send" now actually sends the reply via Gmail.
// Fix 8: Shows original email body in a collapsible accordion.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { Check, Pencil, X, ChevronDown, ChevronUp, Lightbulb, RefreshCw, Mail } from "lucide-react";
import type { Approval, Priority } from "@/types";
import { formatRelativeTime, getInitials } from "@/lib/utils";

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: { label: "High", className: "badge badge-high" },
  medium: { label: "Medium", className: "badge badge-medium" },
  low: { label: "Low", className: "badge badge-low" },
};

interface ApprovalCardProps {
  approval: Approval;
  index: number;
}

export function ApprovalCard({ approval, index }: ApprovalCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false); // Fix 8
  const [actionTaken, setActionTaken] = useState<"approved" | "rejected" | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedReply, setEditedReply] = useState(approval.draftReply);
  const [actionError, setActionError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

  const priority = priorityConfig[approval.priority];
  const initials = getInitials(approval.sender);
  const delayClass = `delay-${(index + 1) * 200}`;

  // ─── Fix 4: Actually send the reply, then persist decision ──
  const handleApprove = async () => {
    setIsActioning(true);
    setActionError(null);
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) {
      setActionError("Not authenticated.");
      setIsActioning(false);
      return;
    }

    try {
      // Step 1: Send the email via Gmail API
      const sendRes = await fetch(
        `${backendUrl}/api/v1/analysis/reply/${approval.emailId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reply_body: editedReply }),
        }
      );

      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.detail ?? `Failed to send reply (${sendRes.status})`);
      }

      // Step 2: Persist "approved" status to DB
      await fetch(
        `${backendUrl}/api/v1/analysis/status/${approval.emailId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ approval_status: "approved" }),
        }
      );

      setActionTaken("approved");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    setIsActioning(true);
    setActionError(null);
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) {
      setActionError("Not authenticated.");
      setIsActioning(false);
      return;
    }
    try {
      const res = await fetch(
        `${backendUrl}/api/v1/analysis/status/${approval.emailId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ approval_status: "rejected" }),
        }
      );
      if (!res.ok) throw new Error(`Failed to reject (${res.status})`);
      setActionTaken("rejected");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to reject.");
    } finally {
      setIsActioning(false);
    }
  };

  if (actionTaken) {
    return (
      <div
        className={`card p-5 animate-fade-in opacity-0 ${delayClass}`}
        style={{
          background: actionTaken === "approved" ? "#F0FDF4" : "#FEF2F2",
          borderColor: actionTaken === "approved" ? "#BBF7D0" : "#FECACA",
        }}
      >
        <div className="flex items-center gap-3">
          {actionTaken === "approved" ? (
            <Check size={18} style={{ color: "#059669" }} />
          ) : (
            <X size={18} style={{ color: "#DC2626" }} />
          )}
          <p
            className="text-sm font-medium"
            style={{ color: actionTaken === "approved" ? "#059669" : "#DC2626" }}
          >
            {actionTaken === "approved"
              ? `Reply sent to ${approval.sender} ✓`
              : `Reply rejected — email marked for manual review`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <article
      id={`approval-card-${approval.id}`}
      className={`card animate-fade-in-up opacity-0 ${delayClass} overflow-hidden`}
      aria-label={`Approval request for email: ${approval.emailSubject}`}
    >
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                {approval.emailSubject}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {approval.sender} · {formatRelativeTime(approval.receivedAt)}
              </p>
            </div>
            <span className={priority.className}>{priority.label}</span>
          </div>

          {/* AI Reasoning */}
          <div
            className="mt-3 rounded-lg px-3 py-2.5"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Lightbulb size={12} style={{ color: "#D97706" }} />
              <p className="text-xs font-medium" style={{ color: "#D97706" }}>
                Why this draft?
              </p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text)" }}>
              {approval.reasoning}
            </p>
          </div>
        </div>
      </div>

      {/* Fix 8: Original Email Accordion */}
      {approval.originalBody && (
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          <button
            id={`btn-toggle-original-${approval.id}`}
            onClick={() => setIsOriginalExpanded(!isOriginalExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
            style={{ background: "var(--color-surface)" }}
            aria-expanded={isOriginalExpanded}
          >
            <div className="flex items-center gap-2">
              <Mail size={13} style={{ color: "var(--color-text-muted)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Original Email
              </span>
            </div>
            {isOriginalExpanded ? (
              <ChevronUp size={14} style={{ color: "var(--color-text-muted)" }} />
            ) : (
              <ChevronDown size={14} style={{ color: "var(--color-text-muted)" }} />
            )}
          </button>

          {isOriginalExpanded && (
            <div className="px-5 pb-4">
              <pre
                className="text-xs leading-relaxed whitespace-pre-wrap font-sans rounded-xl p-4 max-h-48 overflow-y-auto"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                {approval.originalBody}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Draft Reply — Collapsible */}
      <div style={{ borderTop: "1px solid var(--color-border)" }}>
        <button
          id={`btn-toggle-draft-${approval.id}`}
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
          style={{ background: "var(--color-surface)" }}
          aria-expanded={isExpanded}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Draft Reply
          </span>
          {isExpanded ? (
            <ChevronUp size={14} style={{ color: "var(--color-text-muted)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--color-text-muted)" }} />
          )}
        </button>

        {isExpanded && (
          <div className="px-5 pb-5">
            {editMode ? (
              <textarea
                className="w-full h-40 resize-none rounded-xl p-4 text-sm outline-none border focus:border-[var(--color-primary)]"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
              />
            ) : (
              <pre
                className="text-sm leading-relaxed whitespace-pre-wrap font-sans rounded-xl p-4"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                {editedReply}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {actionError && (
        <div className="px-5 pb-3 text-xs text-red-600">
          ⚠ {actionError}
        </div>
      )}

      {/* Actions */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <button
          id={`btn-approve-${approval.id}`}
          onClick={handleApprove}
          disabled={isActioning}
          className="btn btn-success flex-1 gap-2"
          aria-label={`Approve and send draft reply to ${approval.sender}`}
        >
          {isActioning ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
          Approve &amp; Send
        </button>
        <button
          id={`btn-edit-${approval.id}`}
          onClick={() => setEditMode((v) => !v)}
          className="btn btn-secondary"
          aria-label="Edit draft"
        >
          <Pencil size={14} />
          {editMode ? "Preview" : "Edit"}
        </button>
        <button
          id={`btn-reject-${approval.id}`}
          onClick={handleReject}
          disabled={isActioning}
          className="btn btn-danger"
          aria-label={`Reject draft reply to ${approval.sender}`}
        >
          {isActioning ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
          Reject
        </button>
      </div>
    </article>
  );
}
