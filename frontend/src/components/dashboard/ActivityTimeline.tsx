"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — ActivityTimeline
// Lazy-loaded by DashboardClient. Renders the AI agent activity
// feed from the list of analysis suggestions.
// ─────────────────────────────────────────────────────────────

import { FileText, MessageSquare, PlusSquare } from "lucide-react";

interface RawSuggestion {
  action?: string;
  subject?: string;
  sender?: string;
  received_at?: string;
  email_id?: string;
}

interface TimelineItem {
  id: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  description: string;
  detail?: string;
  timestamp: string;
}

function buildTimeline(suggestions: RawSuggestion[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const s of suggestions.slice(0, 6)) {
    const action = s.action;
    const subject = s.subject ?? "an email";
    const sender = s.sender ?? "";
    const receivedAt = s.received_at ?? "";
    const id = s.email_id ?? String(Math.random());
    const shortSubject = `"${subject.slice(0, 40)}${subject.length > 40 ? "…" : ""}"`;
    const timestamp = receivedAt
      ? new Date(receivedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "";

    if (action === "reply") {
      items.push({ id, icon: MessageSquare, color: "#D97706", bg: "#FEF3C7",
        description: `Draft prepared for ${shortSubject}`,
        detail: sender ? `From: ${sender}` : undefined, timestamp });
    } else if (action === "reminder") {
      items.push({ id, icon: PlusSquare, color: "#7C3AED", bg: "#EDE9FE",
        description: `Reminder created for ${shortSubject}`,
        detail: sender ? `From: ${sender}` : undefined, timestamp });
    } else {
      items.push({ id, icon: FileText, color: "#7C3AED", bg: "#EDE9FE",
        description: `Analysed ${shortSubject}`,
        detail: action ? `Action: ${action}` : undefined, timestamp });
    }
  }
  return items;
}

export function ActivityTimeline({ suggestions }: { suggestions: RawSuggestion[] }) {
  const timeline = buildTimeline(suggestions);

  if (timeline.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: "var(--color-text-muted)" }}>
        No AI activity yet. Analyze your inbox to get started.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {timeline.map((item, index) => {
        const Icon = item.icon;
        const isLast = index === timeline.length - 1;
        return (
          <div key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: item.bg }}
              >
                <Icon size={14} style={{ color: item.color }} />
              </div>
              {!isLast && (
                <div
                  className="w-px flex-1 mt-1"
                  style={{ background: "var(--color-border)", minHeight: "16px" }}
                />
              )}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                {item.description}
              </p>
              {item.detail && (
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {item.detail}
                </p>
              )}
              <p className="text-xs mt-1 font-medium" style={{ color: item.color }}>
                {item.timestamp}
              </p>
            </div>
          </div>
        );
      })}
      {/* Live indicator */}
      <div className="flex gap-3 items-center pt-1">
        <div className="w-8 flex justify-center">
          <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "#10B981" }} />
        </div>
        <p className="text-xs" style={{ color: "#10B981" }}>
          Agents monitoring your inbox…
        </p>
      </div>
    </div>
  );
}
