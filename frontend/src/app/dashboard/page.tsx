// ─────────────────────────────────────────────────────────────
// SuperClerk — Dashboard Home Page
// ─────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { auth } from "@/auth";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { mockStats, mockTimeline } from "@/lib/mock-data";
import { getGreeting, getFirstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const firstName = getFirstName(session?.user?.name);
  const greeting = getGreeting();
  const avatarUrl = session?.user?.image;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* ── Page Header ───────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 animate-fade-in-up opacity-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={session?.user?.name ?? "User"}
                className="w-10 h-10 rounded-full ring-2 ring-[var(--color-border)]"
              />
            )}
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--color-text)" }}
              >
                {greeting}, {firstName} 👋
              </h1>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Here&apos;s what your AI agents have been up to today
              </p>
            </div>
          </div>
        </div>

        {/* Date */}
        <div
          className="text-right px-4 py-2 rounded-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Today</p>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────── */}
      <div className="flex gap-8">
        {/* Left Column */}
        <div className="flex-1 space-y-8">
          {/* Stat Cards */}
          <section aria-label="Dashboard statistics">
            <div className="grid grid-cols-2 gap-4">
              {mockStats.map((stat, index) => (
                <StatCard key={stat.id} stat={stat} index={index} />
              ))}
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
              {[
                {
                  label: "Review Inbox",
                  desc: "7 emails awaiting analysis",
                  href: "/dashboard/inbox",
                  icon: "📧",
                  color: "#EDE9FE",
                },
                {
                  label: "Approve Replies",
                  desc: "2 drafts need your sign-off",
                  href: "/dashboard/approvals",
                  icon: "✅",
                  color: "#FEF3C7",
                },
              ].map(({ label, desc, href, icon, color }) => (
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

        {/* Right Column — Activity Timeline */}
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
          <ActivityTimeline events={mockTimeline} />
        </aside>
      </div>
    </div>
  );
}
