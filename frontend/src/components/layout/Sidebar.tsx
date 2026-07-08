"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Sidebar Navigation
// ─────────────────────────────────────────────────────────────

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
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const navItems = [
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
    badge: 7,
  },
  {
    label: "Approvals",
    href: "/dashboard/approvals",
    icon: CheckCircle,
    id: "nav-approvals",
    badge: 2,
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

  const user = session?.user;
  const initials = getInitials(user?.name ?? "U");

  return (
    <aside
      className="flex flex-col w-64 h-screen sticky top-0 border-r"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 py-5 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
        >
          <Layers size={18} color="white" />
        </div>
        <div>
          <p className="font-bold text-base leading-tight" style={{ color: "var(--color-text)" }}>
            SuperClerk
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            AI Business OS
          </p>
        </div>
      </div>

      {/* AI Status Badge */}
      <div className="px-4 py-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" />
          <span className="text-xs font-medium" style={{ color: "#15803D" }}>
            AI Agents Active
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              id={item.id}
              href={item.href}
              className={cn("sidebar-link", isActive && "active")}
            >
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className="text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: isActive ? "#DDD6FE" : "var(--color-surface)",
                    color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div
        className="p-4 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "User"}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-[var(--color-border)]"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--color-text)" }}
            >
              {user?.name ?? "User"}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: "var(--color-text-muted)" }}
            >
              {user?.email ?? ""}
            </p>
          </div>
        </div>
        <button
          id="btn-sign-out"
          onClick={() => {
            // Clear the backend JWT so useAuthSync re-runs on next sign-in
            // (this ensures fresh OAuth tokens including refresh_token are saved)
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
    </aside>
  );
}
