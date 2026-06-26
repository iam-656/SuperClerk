// ─────────────────────────────────────────────────────────────
// SuperClerk — Dashboard Layout Shell
// Wraps all /dashboard/* pages with sidebar + main content.
// Mounts useAuthSync to persist Google user to backend on login.
// ─────────────────────────────────────────────────────────────

"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { useAuthSync } from "@/hooks/useAuthSync";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  // Syncs the authenticated Google user to the FastAPI backend on mount.
  // Fires once per browser session — stores the JWT in sessionStorage.
  useAuthSync();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-surface)" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
