// ─────────────────────────────────────────────────────────────
// SuperClerk — Dashboard Home Page (Server Shell)
// Renders greeting/header server-side; live stats are loaded
// client-side by <DashboardClient />.
// ─────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
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

      {/* ── Live Stats + Timeline (client-side) ──────── */}
      <DashboardClient />
    </div>
  );
}
