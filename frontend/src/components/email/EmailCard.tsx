// ─────────────────────────────────────────────────────────────
// SuperClerk — Email Card Component
// ─────────────────────────────────────────────────────────────

import { ArrowRight, Clock } from "lucide-react";
import type { Email, Priority } from "@/types";
import { formatRelativeTime, getInitials } from "@/lib/utils";

const priorityConfig: Record<
  Priority,
  { label: string; className: string }
> = {
  high: { label: "High Priority", className: "badge badge-high" },
  medium: { label: "Medium Priority", className: "badge badge-medium" },
  low: { label: "Low Priority", className: "badge badge-low" },
};

interface EmailCardProps {
  email: Email;
  index: number;
}

export function EmailCard({ email, index }: EmailCardProps) {
  const priority = priorityConfig[email.priority];
  const initials = getInitials(email.sender);
  const delayClass = `delay-${Math.min((index + 1) * 100, 400)}`;
  const isUnread = email.status === "unread";

  return (
    <article
      id={`email-card-${email.id}`}
      className={`card p-5 animate-fade-in-up opacity-0 ${delayClass} cursor-pointer`}
      role="article"
      aria-label={`Email from ${email.sender}: ${email.subject}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isUnread && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "var(--color-primary)" }}
                    aria-label="Unread"
                  />
                )}
                <p
                  className="font-semibold text-sm truncate"
                  style={{ color: "var(--color-text)" }}
                >
                  {email.subject}
                </p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {email.sender} · {email.senderEmail}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={priority.className}>{priority.label}</span>
            </div>
          </div>

          {/* AI Summary */}
          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "#FAF5FF", border: "1px solid #EDE9FE" }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: "#7C3AED" }}>
              🤖 AI Summary
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
              {email.summary}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <Clock size={12} style={{ color: "var(--color-text-muted)" }} />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {formatRelativeTime(email.receivedAt)}
              </span>
              {email.labels.map((label) => (
                <span key={label} className="badge badge-gray">
                  {label}
                </span>
              ))}
            </div>

            <button
              id={`btn-action-${email.id}`}
              className="btn btn-primary py-1.5 px-3 text-xs"
              aria-label={`Action: ${email.recommendedAction}`}
            >
              {email.recommendedAction}
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
