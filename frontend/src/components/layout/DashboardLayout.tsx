// ─────────────────────────────────────────────────────────────
// SuperClerk — Dashboard Layout Shell
// Wraps all /dashboard/* pages with sidebar + main content
// ─────────────────────────────────────────────────────────────

import { Sidebar } from "@/components/layout/Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-surface)" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
