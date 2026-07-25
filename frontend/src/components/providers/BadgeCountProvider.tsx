// ─────────────────────────────────────────────────────────────
// SuperClerk — BadgeCountProvider
// Provides live badge counts + control functions via React Context.
// Sidebar reads counts; inbox page calls decrementInbox() for
// instant badge updates when an email is opened.
// ─────────────────────────────────────────────────────────────

"use client";

import { createContext, useContext } from "react";
import { useBadgeCounts, type BadgeCountsApi } from "@/hooks/useBadgeCounts";

const BadgeCountContext = createContext<BadgeCountsApi>({
  inbox: 0,
  approvals: 0,
  reminders: 0,
  decrementInbox: () => {},
  refresh: () => {},
});

export function BadgeCountProvider({ children }: { children: React.ReactNode }) {
  const api = useBadgeCounts();
  return (
    <BadgeCountContext.Provider value={api}>
      {children}
    </BadgeCountContext.Provider>
  );
}

export function useBadgeCountContext(): BadgeCountsApi {
  return useContext(BadgeCountContext);
}
