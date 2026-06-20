// ─────────────────────────────────────────────────────────────
// SuperClerk — Approvals Center Page
// ─────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { mockApprovals } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Approvals" };

export default function ApprovalsPage() {
  const pendingCount = mockApprovals.filter((a) => a.status === "pending").length;

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
      {mockApprovals.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">✅</p>
          <p className="font-medium" style={{ color: "var(--color-text)" }}>
            All caught up!
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            No pending approvals right now
          </p>
        </div>
      ) : (
        <div className="space-y-6" role="feed" aria-label="Pending approvals">
          {mockApprovals.map((approval, index) => (
            <ApprovalCard key={approval.id} approval={approval} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
