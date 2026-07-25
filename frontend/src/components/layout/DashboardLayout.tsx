// ─────────────────────────────────────────────────────────────
// SuperClerk — Dashboard Layout Shell
// Wraps all /dashboard/* pages with sidebar + main content.
// Mounts useAuthSync to persist Google user to backend on login.
// Wraps the tree with BadgeCountProvider so Sidebar gets live counts.
// ─────────────────────────────────────────────────────────────

"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { useAuthSync } from "@/hooks/useAuthSync";
import { BadgeCountProvider } from "@/components/providers/BadgeCountProvider";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  useAuthSync();

  return (
    <BadgeCountProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-surface)" }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </BadgeCountProvider>
  );
}
