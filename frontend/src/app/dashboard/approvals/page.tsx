"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Approvals Center Page
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import type { Approval } from "@/types";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    const token = sessionStorage.getItem("sc_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/v1/analysis/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      
      const loaded: Approval[] = [];
      for (const s of data.results ?? []) {
        // Only show pending "reply" suggestions in Approvals
        if (s.action === "reply" && s.approval_status !== "rejected") {
          loaded.push({
            id: s.email_id,
            emailId: s.email_id,
            emailSubject: s.subject,
            sender: s.sender,
            senderEmail: s.sender_email || s.sender,
            receivedAt: s.received_at || new Date().toISOString(),
            draftReply: s.reply_draft || "",
            reasoning: s.summary,
            status: (s.approval_status as "pending" | "approved" | "rejected" | "edited") || "pending",
            createdAt: s.received_at || new Date().toISOString(),
            priority: s.priority <= 2 ? "high" : s.priority === 3 ? "medium" : "low"
          });
        }
      }
      setApprovals(loaded);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* ── Header ──────────────────────────────────── */}
      <div className="mb-8 animate-fade-in-up opacity-0">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: "var(--color-text)" }}
            >
              <ShieldCheck size={24} style={{ color: "var(--color-primary)" }} />
              Approval Center
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              Review AI-drafted replies before they&apos;re sent
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchApprovals}
              disabled={loading}
              className="btn btn-secondary text-sm py-2 px-3 gap-2"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            {pendingCount > 0 && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-dot" />
                <span className="text-sm font-medium" style={{ color: "#D97706" }}>
                  {pendingCount} awaiting your approval
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Human-in-the-Loop Banner ─────────────────── */}
      <div
        className="rounded-2xl p-4 mb-8 flex items-center gap-4 animate-fade-in-up opacity-0 delay-100"
        style={{
          background: "linear-gradient(135deg, #EDE9FE, #FAF5FF)",
          border: "1px solid #DDD6FE",
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#8B5CF6" }}
        >
          <span className="text-lg">🧠</span>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
            Human-in-the-Loop AI
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#6D28D9" }}>
            SuperClerk never sends emails without your explicit approval. You are always in control.
          </p>
        </div>
      </div>

      {/* ── Approval Cards ───────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={32} className="animate-spin" style={{ color: "var(--color-primary)" }} />
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <p className="text-4xl mb-4">✅</p>
          <p className="font-medium" style={{ color: "var(--color-text)" }}>
            All caught up!
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            No pending AI replies awaiting your approval right now.
          </p>
        </div>
      ) : (
        <div className="space-y-6" role="feed" aria-label="Pending approvals">
          {approvals.map((approval, index) => (
            <ApprovalCard key={approval.id} approval={approval} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
