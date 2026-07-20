"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Approval Card Component
// Fix 5: Reject (and Approve) now persists to backend DB.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { Check, Pencil, X, ChevronDown, ChevronUp, Lightbulb, RefreshCw } from "lucide-react";
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
  const [actionTaken, setActionTaken] = useState<"approved" | "rejected" | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedReply, setEditedReply] = useState(approval.draftReply);
  const [actionError, setActionError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

  const priority = priorityConfig[approval.priority];
  const initials = getInitials(approval.sender);
  const delayClass = `delay-${(index + 1) * 200}`;

  // ─── Persist decision to backend ─────────────────────────
  const persistDecision = async (
    newStatus: "approved" | "rejected"
  ): Promise<boolean> => {
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) return false;
    try {
      const res = await fetch(
        `${backendUrl}/api/v1/analysis/status/${approval.emailId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ approval_status: newStatus }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleApprove = async () => {
    setIsActioning(true);
    setActionError(null);
    const ok = await persistDecision("approved");
    if (!ok) {
      setActionError("Failed to save decision. Please try again.");
      setIsActioning(false);
      return;
    }
    setActionTaken("approved");
    setIsActioning(false);
  };

  const handleReject = async () => {
    setIsActioning(true);
    setActionError(null);
    const ok = await persistDecision("rejected");
    if (!ok) {
      setActionError("Failed to save decision. Please try again.");
      setIsActioning(false);
      return;
    }
    setActionTaken("rejected");
    setIsActioning(false);
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
              ? `Reply approved and sent to ${approval.sender}`
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
          aria-label={`Approve draft reply to ${approval.sender}`}
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
