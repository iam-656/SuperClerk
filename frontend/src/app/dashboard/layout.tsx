// ─────────────────────────────────────────────────────────────
// SuperClerk — Dashboard App Layout
// Applies sidebar shell to all /dashboard/* routes
// ─────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | SuperClerk",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
