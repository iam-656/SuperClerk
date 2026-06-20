// ─────────────────────────────────────────────────────────────
// SuperClerk — Mock Data Layer
// All data is typed and realistic for demo purposes.
// In production, this is replaced by real API calls.
// ─────────────────────────────────────────────────────────────

import type {
  Email,
  Approval,
  TimelineEvent,
  DashboardStat,
} from "@/types";

// ── Emails ───────────────────────────────────────────────────

export const mockEmails: Email[] = [
  {
    id: "email-001",
    subject: "Q3 Partnership Proposal — Exclusive Offer",
    sender: "Sarah Chen",
    senderEmail: "sarah.chen@techventures.com",
    receivedAt: "2026-06-20T07:30:00Z",
    summary:
      "TechVentures is proposing a 6-month partnership for co-marketing. They're offering a 30% revenue share and need a response by EOD Friday. High commercial value.",
    priority: "high",
    status: "unread",
    recommendedAction: "Schedule a call to discuss terms",
    labels: ["Partnership", "Urgent"],
    snippet:
      "Hi, we've been following SuperClerk's growth closely and believe a partnership could...",
  },
  {
    id: "email-002",
    subject: "Invoice #2847 — Due in 3 Days",
    sender: "Accounts - CloudBase",
    senderEmail: "billing@cloudbase.io",
    receivedAt: "2026-06-20T06:15:00Z",
    summary:
      "Invoice for $1,240 for cloud infrastructure (May 2026) is due on June 23rd. Payment details are in the attachment.",
    priority: "high",
    status: "unread",
    recommendedAction: "Draft payment confirmation reply",
    labels: ["Finance", "Invoice"],
    snippet: "Your invoice #2847 for $1,240.00 is due on June 23, 2026...",
  },
  {
    id: "email-003",
    subject: "Meeting Notes — Product Roadmap Review",
    sender: "David Kim",
    senderEmail: "d.kim@teaminternal.com",
    receivedAt: "2026-06-19T16:45:00Z",
    summary:
      "Internal meeting recap covering Q3 feature priorities. Key decisions: delay AI reporting to Q4, accelerate Gmail agent to July launch. No immediate action needed.",
    priority: "medium",
    status: "read",
    recommendedAction: "Acknowledge receipt",
    labels: ["Internal", "Roadmap"],
    snippet: "Here are the notes from today's product roadmap session...",
  },
  {
    id: "email-004",
    subject: "Welcome to ProductHunt — Your Launch is Scheduled",
    sender: "ProductHunt Team",
    senderEmail: "hello@producthunt.com",
    receivedAt: "2026-06-19T14:00:00Z",
    summary:
      "ProductHunt confirmed the SuperClerk launch for July 1st. The product page is live in draft mode. Reminder to prepare assets and set notification.",
    priority: "medium",
    status: "read",
    recommendedAction: "Reply confirming readiness",
    labels: ["Launch", "Marketing"],
    snippet: "Congratulations! Your product launch has been scheduled for...",
  },
  {
    id: "email-005",
    subject: "New Subscriber — Free Trial Started",
    sender: "SuperClerk System",
    senderEmail: "noreply@superclerk.app",
    receivedAt: "2026-06-19T10:30:00Z",
    summary:
      "A new user (james.f@startup.io) started a free trial. Standard onboarding email was auto-sent. No action required.",
    priority: "low",
    status: "actioned",
    recommendedAction: "No action needed",
    labels: ["System", "Onboarding"],
    snippet: "A new free trial has been activated for james.f@startup.io...",
  },
  {
    id: "email-006",
    subject: "Tech Blog Feature — Interview Request",
    sender: "Alex Morgan",
    senderEmail: "alex@buildersweekly.com",
    receivedAt: "2026-06-18T09:00:00Z",
    summary:
      "BuildersWeekly wants to feature SuperClerk in their 'AI for Business' series. Asking for a 20-minute video interview. Good PR opportunity.",
    priority: "medium",
    status: "unread",
    recommendedAction: "Accept and propose time slots",
    labels: ["PR", "Media"],
    snippet:
      "We'd love to feature SuperClerk in our upcoming AI for Business series...",
  },
  {
    id: "email-007",
    subject: "Google Cloud Credits — Startup Program",
    sender: "Google Cloud Startups",
    senderEmail: "startups@google.com",
    receivedAt: "2026-06-18T08:00:00Z",
    summary:
      "$10,000 in Google Cloud credits are available through the startup program. Application deadline is June 30th. Straightforward application process.",
    priority: "high",
    status: "unread",
    recommendedAction: "Apply before June 30th",
    labels: ["Opportunity", "Finance"],
    snippet:
      "As a qualifying startup, you're eligible for $10,000 in Google Cloud credits...",
  },
];

// ── Approvals ────────────────────────────────────────────────

export const mockApprovals: Approval[] = [
  {
    id: "approval-001",
    emailId: "email-001",
    emailSubject: "Q3 Partnership Proposal — Exclusive Offer",
    sender: "Sarah Chen",
    senderEmail: "sarah.chen@techventures.com",
    receivedAt: "2026-06-20T07:30:00Z",
    draftReply: `Hi Sarah,

Thank you for reaching out about this partnership opportunity. The proposal looks very interesting, and I'd love to learn more about the co-marketing structure.

Could we schedule a 30-minute call this week to discuss the details? I'm available Thursday or Friday afternoon (PKT timezone).

Looking forward to speaking with you.

Best regards,
Ali`,
    reasoning:
      "This is a high-value partnership inquiry with a clear deadline. A prompt, professional response keeps the conversation open without committing to anything.",
    status: "pending",
    createdAt: "2026-06-20T08:12:00Z",
    priority: "high",
  },
  {
    id: "approval-002",
    emailId: "email-006",
    emailSubject: "Tech Blog Feature — Interview Request",
    sender: "Alex Morgan",
    senderEmail: "alex@buildersweekly.com",
    receivedAt: "2026-06-18T09:00:00Z",
    draftReply: `Hi Alex,

Thanks for thinking of SuperClerk — we'd be happy to be featured in your AI for Business series!

I'm available for a 20-minute interview on June 25th or 26th between 2–5 PM PKT. Please let me know which works for you, and I'll send a calendar invite.

Looking forward to it!

Best,
Ali`,
    reasoning:
      "Media features build brand awareness at no cost. The interview is low-effort and high-reward for a pre-launch startup.",
    status: "pending",
    createdAt: "2026-06-20T08:14:00Z",
    priority: "medium",
  },
];

// ── Timeline Events ──────────────────────────────────────────

export const mockTimeline: TimelineEvent[] = [
  {
    id: "tl-001",
    timestamp: "8:00 AM",
    type: "summarized",
    description: "Summarized 7 emails",
    detail: "Processed overnight inbox",
  },
  {
    id: "tl-002",
    timestamp: "8:05 AM",
    type: "classified",
    description: "Classified priorities",
    detail: "3 high, 3 medium, 1 low",
  },
  {
    id: "tl-003",
    timestamp: "8:12 AM",
    type: "draft_prepared",
    description: "Prepared reply to Sarah Chen",
    detail: "Partnership proposal response",
  },
  {
    id: "tl-004",
    timestamp: "8:14 AM",
    type: "waiting_approval",
    description: "Waiting for your approval",
    detail: "2 drafts pending review",
  },
  {
    id: "tl-005",
    timestamp: "8:20 AM",
    type: "draft_prepared",
    description: "Prepared reply to Alex Morgan",
    detail: "Interview request response",
  },
  {
    id: "tl-006",
    timestamp: "8:25 AM",
    type: "task_created",
    description: "Created task: Apply for Google Cloud credits",
    detail: "Deadline: June 30th",
  },
];

// ── Dashboard Stats ──────────────────────────────────────────

export const mockStats: DashboardStat[] = [
  {
    id: "stat-01",
    label: "Important Emails",
    value: 7,
    icon: "Mail",
    color: "purple",
    href: "/dashboard/inbox",
  },
  {
    id: "stat-02",
    label: "Pending Approvals",
    value: 2,
    icon: "CheckCircle",
    color: "amber",
    href: "/dashboard/approvals",
  },
  {
    id: "stat-03",
    label: "Planned Actions",
    value: 4,
    icon: "Zap",
    color: "blue",
    href: "/dashboard/inbox",
  },
  {
    id: "stat-04",
    label: "Today's Tasks",
    value: 3,
    icon: "ListTodo",
    color: "emerald",
    href: "/dashboard/inbox",
  },
];
