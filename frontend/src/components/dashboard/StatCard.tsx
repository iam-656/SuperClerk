// ─────────────────────────────────────────────────────────────
// SuperClerk — Stat Card Component
// ─────────────────────────────────────────────────────────────

import Link from "next/link";
import { Mail, CheckCircle, Zap, ListTodo } from "lucide-react";
import type { DashboardStat } from "@/types";

const colorMap: Record<
  DashboardStat["color"],
  { bg: string; iconBg: string; text: string; border: string }
> = {
  purple: {
    bg: "#FAF5FF",
    iconBg: "#EDE9FE",
    text: "#7C3AED",
    border: "#DDD6FE",
  },
  amber: {
    bg: "#FFFBEB",
    iconBg: "#FEF3C7",
    text: "#D97706",
    border: "#FDE68A",
  },
  blue: {
    bg: "#EFF6FF",
    iconBg: "#DBEAFE",
    text: "#2563EB",
    border: "#BFDBFE",
  },
  emerald: {
    bg: "#F0FDF4",
    iconBg: "#D1FAE5",
    text: "#059669",
    border: "#A7F3D0",
  },
};

const iconMap: Record<string, React.ElementType> = {
  Mail,
  CheckCircle,
  Zap,
  ListTodo,
};

interface StatCardProps {
  stat: DashboardStat;
  index: number;
}

export function StatCard({ stat, index }: StatCardProps) {
  const colors = colorMap[stat.color];
  const Icon = iconMap[stat.icon] ?? Mail;
  const delayClass = `delay-${(index + 1) * 100}` as string;

  return (
    <Link
      href={stat.href}
      id={`stat-card-${stat.id}`}
      className={`card block p-6 animate-fade-in-up opacity-0 ${delayClass}`}
      style={{ background: "var(--color-bg)" }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {stat.label}
          </p>
          <p
            className="text-4xl font-bold"
            style={{ color: "var(--color-text)" }}
          >
            {stat.value}
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: colors.iconBg }}
        >
          <Icon size={22} style={{ color: colors.text }} />
        </div>
      </div>

      {/* Color accent bar */}
      <div
        className="mt-5 h-1 rounded-full"
        style={{ background: colors.border }}
      />
    </Link>
  );
}
