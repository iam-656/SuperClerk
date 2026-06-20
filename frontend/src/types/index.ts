// ─────────────────────────────────────────────────────────────
// SuperClerk — TypeScript Type Definitions
// ─────────────────────────────────────────────────────────────

export type Priority = "high" | "medium" | "low";

export type EmailStatus = "unread" | "read" | "actioned" | "ignored";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "edited";

export type TimelineEventType =
  | "summarized"
  | "classified"
  | "draft_prepared"
  | "waiting_approval"
  | "approved"
  | "rejected"
  | "email_sent"
  | "task_created";

// ── Email ────────────────────────────────────────────────────

export interface Email {
  id: string;
  subject: string;
  sender: string;
  senderEmail: string;
  senderAvatar?: string;
  receivedAt: string; // ISO string
  summary: string;
  priority: Priority;
  status: EmailStatus;
  recommendedAction: string;
  labels: string[];
  snippet: string;
}

// ── Approval ─────────────────────────────────────────────────

export interface Approval {
  id: string;
  emailId: string;
  emailSubject: string;
  sender: string;
  senderEmail: string;
  receivedAt: string;
  draftReply: string;
  reasoning: string;
  status: ApprovalStatus;
  createdAt: string;
  priority: Priority;
}

// ── Timeline ─────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  timestamp: string; // e.g. "8:00 AM"
  type: TimelineEventType;
  description: string;
  detail?: string;
}

// ── Dashboard Stats ──────────────────────────────────────────

export interface DashboardStat {
  id: string;
  label: string;
  value: number;
  icon: string; // lucide icon name
  color: "purple" | "amber" | "blue" | "emerald";
  href: string;
}

// ── User Session ─────────────────────────────────────────────

export interface AppUser {
  id: string;
  name: string;
  email: string;
  image?: string;
}
