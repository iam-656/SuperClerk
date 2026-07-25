"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Dashboard Client Component
// Uses SWR for stale-while-revalidate caching:
//  • Stat cards show cached numbers instantly on revisit
//  • Background-revalidates every 60s
//  • ActivityTimeline is lazy-loaded (code-split, not LCP-critical)
// ─────────────────────────────────────────────────────────────

import { Suspense, lazy } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Mail,
  CheckCircle,
  Bell,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ── Lazy-load the timeline (non-LCP-critical) ─────────────────
const ActivityTimeline = lazy(() =>
  import("@/components/dashboard/ActivityTimeline").then((m) => ({
    default: m.ActivityTimeline,
  }))
);

// ── Types ─────────────────────────────────────────────────────

interface LiveStats {
  unreadEmails: number;
  pendingApprovals: number;
  activeReminders: number;
}

interface RawSuggestion {
  action?: string;
  subject?: string;
  sender?: string;
  received_at?: string;
  email_id?: string;
  approval_status?: string;
}

interface DashboardData {
  stats: LiveStats;
  suggestions: RawSuggestion[];
}

// ── SWR fetcher ───────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardData> {
  const token = sessionStorage.getItem("sc_access_token");
  if (!token) {
    return { stats: { unreadEmails: 0, pendingApprovals: 0, activeReminders: 0 }, suggestions: [] };
  }

  const [emailsRes, suggestionsRes, remindersRes] = await Promise.allSettled([
    fetch(`${BACKEND_URL}/api/v1/emails?page=1&page_size=1&unread_only=true`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${BACKEND_URL}/api/v1/analysis/suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${BACKEND_URL}/api/v1/reminders`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  let unread = 0;
  let approvals = 0;
  let reminders = 0;
  let rawSuggestions: RawSuggestion[] = [];

  if (emailsRes.status === "fulfilled" && emailsRes.value.ok) {
    const d = await emailsRes.value.json();
    unread = d.total ?? 0;
  }
  if (suggestionsRes.status === "fulfilled" && suggestionsRes.value.ok) {
    const d = await suggestionsRes.value.json();
    rawSuggestions = d.results ?? [];
    approvals = rawSuggestions.filter(
      (s) => s.action === "reply" && s.approval_status === "pending"
    ).length;
  }
  if (remindersRes.status === "fulfilled" && remindersRes.value.ok) {
    const d = await remindersRes.value.json() as { is_completed: boolean }[];
    reminders = d.filter((r) => !r.is_completed).length;
  }

  return {
    stats: {
      unreadEmails: unread,
      pendingApprovals: approvals,
      activeReminders: reminders,
    },
    suggestions: rawSuggestions,
  };
}

// ── Skeleton ──────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="card p-6 animate-pulse" style={{ background: "var(--color-bg)" }}>
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-3 rounded w-2/3" style={{ background: "var(--color-border)" }} />
          <div className="h-9 rounded w-1/3" style={{ background: "var(--color-border)" }} />
        </div>
        <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: "var(--color-border)" }} />
      </div>
      <div className="mt-5 h-1 rounded-full" style={{ background: "var(--color-border)" }} />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────

const statConfigs = [
  {
    key: "unreadEmails" as keyof LiveStats,
    label: "Unread Emails",
    icon: Mail,
    color: { iconBg: "#EDE9FE", text: "#7C3AED", bar: "#DDD6FE" },
    href: "/dashboard/inbox",
  },
  {
    key: "pendingApprovals" as keyof LiveStats,
    label: "Pending Approvals",
    icon: CheckCircle,
    color: { iconBg: "#FEF3C7", text: "#D97706", bar: "#FDE68A" },
    href: "/dashboard/approvals",
  },
  {
    key: "activeReminders" as keyof LiveStats,
    label: "Active Reminders",
    icon: Bell,
    color: { iconBg: "#DBEAFE", text: "#2563EB", bar: "#BFDBFE" },
    href: "/dashboard/reminders",
  },
];

function LiveStatCard({
  value,
  label,
  icon: Icon,
  color,
  href,
  index,
}: {
  value: number;
  label: string;
  icon: React.ElementType;
  color: { iconBg: string; text: string; bar: string };
  href: string;
  index: number;
}) {
  return (
    <Link
      href={href}
      className={`card block p-6 animate-fade-in-up opacity-0 delay-${(index + 1) * 100}`}
      style={{ background: "var(--color-bg)" }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </p>
          <p className="text-4xl font-bold" style={{ color: "var(--color-text)" }}>
            {value}
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color.iconBg }}
        >
          <Icon size={22} style={{ color: color.text }} />
        </div>
      </div>
      <div className="mt-5 h-1 rounded-full" style={{ background: color.bar }} />
    </Link>
  );
}

// ── Main Component ────────────────────────────────────────────

export function DashboardClient() {
  const { data, isLoading, error } = useSWR<DashboardData>(
    "dashboard",
    fetchDashboard,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    }
  );

  const stats = data?.stats ?? null;
  const suggestions = data?.suggestions ?? [];

  const quickActions = [
    {
      label: "Review Inbox",
      desc: stats ? `${stats.unreadEmails} unread email${stats.unreadEmails !== 1 ? "s" : ""}` : "Loading…",
      href: "/dashboard/inbox",
      icon: "📧",
      color: "#EDE9FE",
    },
    {
      label: "Approve Replies",
      desc: stats ? `${stats.pendingApprovals} draft${stats.pendingApprovals !== 1 ? "s" : ""} need sign-off` : "Loading…",
      href: "/dashboard/approvals",
      icon: "✅",
      color: "#FEF3C7",
    },
  ];

  return (
    <div className="flex gap-8">
      {/* Left Column */}
      <div className="flex-1 space-y-8">
        {/* Stat Cards */}
        <section aria-label="Dashboard statistics">
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
            >
              Could not load dashboard data. Is the backend running?
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {statConfigs.map((cfg, index) =>
              isLoading && !stats ? (
                <StatSkeleton key={cfg.key} />
              ) : (
                <LiveStatCard
                  key={cfg.key}
                  value={stats?.[cfg.key] ?? 0}
                  label={cfg.label}
                  icon={cfg.icon}
                  color={cfg.color}
                  href={cfg.href}
                  index={index}
                />
              )
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section aria-label="Quick actions">
          <h2
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--color-text-muted)" }}
          >
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map(({ label, desc, href, icon, color }) => (
              <a
                key={label}
                href={href}
                className="card p-4 flex items-center gap-4"
                id={`quick-action-${label.toLowerCase().replace(" ", "-")}`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: color }}
                >
                  {icon}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                    {label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {desc}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* Right Column — Activity Timeline (lazy-loaded) */}
      <aside
        className="w-72 flex-shrink-0 rounded-2xl p-5"
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          height: "fit-content",
        }}
        aria-label="Agent activity timeline"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Agent Activity
          </h2>
          <span className="badge badge-purple">Today</span>
        </div>
        <Suspense
          fallback={
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: "var(--color-border)" }} />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 rounded w-3/4" style={{ background: "var(--color-border)" }} />
                    <div className="h-2.5 rounded w-1/2" style={{ background: "var(--color-border)" }} />
                  </div>
                </div>
              ))}
            </div>
          }
        >
          <ActivityTimeline suggestions={suggestions} />
        </Suspense>
      </aside>
    </div>
  );
}
