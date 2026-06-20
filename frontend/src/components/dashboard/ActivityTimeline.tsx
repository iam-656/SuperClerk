// ─────────────────────────────────────────────────────────────
// SuperClerk — Activity Timeline Component
// ─────────────────────────────────────────────────────────────

import {
  FileText,
  Tag,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  PlusSquare,
} from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@/types";

const eventConfig: Record<
  TimelineEventType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  summarized: { icon: FileText, color: "#7C3AED", bg: "#EDE9FE" },
  classified: { icon: Tag, color: "#2563EB", bg: "#DBEAFE" },
  draft_prepared: { icon: MessageSquare, color: "#D97706", bg: "#FEF3C7" },
  waiting_approval: { icon: Clock, color: "#EA580C", bg: "#FFEDD5" },
  approved: { icon: CheckCircle, color: "#059669", bg: "#D1FAE5" },
  rejected: { icon: XCircle, color: "#DC2626", bg: "#FEE2E2" },
  email_sent: { icon: Send, color: "#059669", bg: "#D1FAE5" },
  task_created: { icon: PlusSquare, color: "#7C3AED", bg: "#EDE9FE" },
};

interface ActivityTimelineProps {
  events: TimelineEvent[];
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <div className="space-y-1">
      {events.map((event, index) => {
        const config = eventConfig[event.type];
        const Icon = config.icon;
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="flex gap-3">
            {/* Icon + Connector */}
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: config.bg }}
              >
                <Icon size={14} style={{ color: config.color }} />
              </div>
              {!isLast && (
                <div
                  className="w-px flex-1 mt-1"
                  style={{ background: "var(--color-border)", minHeight: "16px" }}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 ${isLast ? "" : ""}`}>
              <div className="flex items-baseline gap-2">
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  {event.description}
                </p>
              </div>
              {event.detail && (
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {event.detail}
                </p>
              )}
              <p
                className="text-xs mt-1 font-medium"
                style={{ color: config.color }}
              >
                {event.timestamp}
              </p>
            </div>
          </div>
        );
      })}

      {/* Live indicator */}
      <div className="flex gap-3 items-center pt-1">
        <div className="w-8 flex justify-center">
          <span
            className="w-2 h-2 rounded-full animate-pulse-dot"
            style={{ background: "#10B981" }}
          />
        </div>
        <p className="text-xs" style={{ color: "#10B981" }}>
          Agents monitoring your inbox…
        </p>
      </div>
    </div>
  );
}
