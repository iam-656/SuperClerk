"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Sidebar Navigation
// Features:
//  • Collapsible (icon-only mode) with localStorage persistence
//  • Reordered nav: Dashboard → Inbox → Approvals → Reminders → Settings
//  • Live badge counts from BadgeCountProvider
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Mail,
  CheckCircle,
  Settings,
  LogOut,
  Layers,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import { useBadgeCountContext } from "@/components/providers/BadgeCountProvider";
import type { BadgeCounts } from "@/hooks/useBadgeCounts";

const COLLAPSED_KEY = "sc_sidebar_collapsed";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  id: string;
  badgeKey?: keyof BadgeCounts;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    id: "nav-dashboard",
  },
  {
    label: "Inbox",
    href: "/dashboard/inbox",
    icon: Mail,
    id: "nav-inbox",
    badgeKey: "inbox",
  },
  {
    label: "Approvals",
    href: "/dashboard/approvals",
    icon: CheckCircle,
    id: "nav-approvals",
    badgeKey: "approvals",
  },
  {
    label: "Reminders",
    href: "/dashboard/reminders",
    icon: Bell,
    id: "nav-reminders",
    badgeKey: "reminders",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    id: "nav-settings",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const badges = useBadgeCountContext();

  const [collapsed, setCollapsed] = useState(false);
  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch { /* ignore */ }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const user = session?.user;
  const initials = getInitials(user?.name ?? "U");

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 border-r flex-shrink-0 transition-all duration-300"
      style={{
        width: collapsed ? "4rem" : "16rem",
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* ── Logo + Collapse toggle ────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-4 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
        >
          <Layers size={18} color="white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-base leading-tight truncate" style={{ color: "var(--color-text)" }}>
              SuperClerk
            </p>
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              AI Business OS
            </p>
          </div>
        )}
        {/* Collapse toggle — top-right of logo area */}
        <button
          id="btn-sidebar-collapse"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--color-surface)] flex-shrink-0 ml-auto"
          style={{ color: "var(--color-text-muted)" }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* ── AI Status Badge ───────────────────────────── */}
      {!collapsed && (
        <div className="px-4 py-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot flex-shrink-0" />
            <span className="text-xs font-medium truncate" style={{ color: "#15803D" }}>
              AI Agents Active
            </span>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="flex justify-center py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-dot" title="AI Agents Active" />
        </div>
      )}

      {/* ── Navigation ───────────────────────────────── */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

          return (
            <Link
              key={item.id}
              id={item.id}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors text-sm font-medium",
                collapsed ? "justify-center" : "",
                isActive
                  ? "text-[var(--color-primary)] bg-[#EDE9FE]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className="text-xs font-semibold min-w-[1.25rem] h-5 rounded-full flex items-center justify-center px-1"
                      style={{
                        background: isActive ? "#DDD6FE" : "var(--color-surface)",
                        color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                      }}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </>
              )}
              {/* Collapsed: show dot if there is a badge */}
              {collapsed && badgeCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-primary)]"
                  aria-label={`${badgeCount} pending`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile ──────────────────────────────── */}
      {!collapsed && (
        <div className="p-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3 mb-3">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "User"}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-[var(--color-border)] flex-shrink-0"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
              >
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                {user?.name ?? "User"}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                {user?.email ?? ""}
              </p>
            </div>
          </div>
          <button
            id="btn-sign-out"
            onClick={() => {
              sessionStorage.removeItem("sc_access_token");
              signOut({ callbackUrl: "/" });
            }}
            className="btn btn-secondary w-full text-sm py-1.5"
            aria-label="Sign out"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
