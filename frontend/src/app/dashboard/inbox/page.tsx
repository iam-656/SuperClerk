"use client";

// ─────────────────────────────────────────────────────────────
// SuperClerk — Email Inbox Page
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { EmailCard } from "@/components/email/EmailCard";
import { mockEmails } from "@/lib/mock-data";
import type { EmailStatus } from "@/types";

type FilterTab = "all" | EmailStatus;

const tabs: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Actioned", value: "actioned" },
  { label: "Read", value: "read" },
];

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = mockEmails.filter((email) => {
    const matchesTab = activeTab === "all" || email.status === activeTab;
    const matchesSearch =
      search === "" ||
      email.subject.toLowerCase().includes(search.toLowerCase()) ||
      email.sender.toLowerCase().includes(search.toLowerCase()) ||
      email.summary.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────── */}
      <div className="mb-8 animate-fade-in-up opacity-0">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Inbox
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          {mockEmails.length} emails analyzed · {mockEmails.filter((e) => e.status === "unread").length} unread
        </p>
      </div>

      {/* ── Search + Filter ──────────────────────────── */}
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up opacity-0 delay-100">
        <div
          className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Search size={16} style={{ color: "var(--color-text-muted)" }} aria-hidden="true" />
          <input
            id="inbox-search"
            type="search"
            placeholder="Search emails…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text)" }}
            aria-label="Search emails"
          />
        </div>
        <button
          id="btn-filter"
          className="btn btn-secondary"
          aria-label="Open filters"
        >
          <SlidersHorizontal size={16} />
          Filter
        </button>
      </div>

      {/* ── Tabs ─────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 animate-fade-in-up opacity-0 delay-200"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        role="tablist"
        aria-label="Email filter tabs"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;
          const count =
            tab.value === "all"
              ? mockEmails.length
              : mockEmails.filter((e) => e.status === tab.value).length;

          return (
            <button
              key={tab.value}
              id={`tab-${tab.value}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.value)}
              className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive ? "var(--color-bg)" : "transparent",
                color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
              }}
            >
              {tab.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  background: isActive ? "#EDE9FE" : "var(--color-border)",
                  color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Email List ───────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 animate-fade-in opacity-0">
          <p className="text-4xl mb-4">📭</p>
          <p className="font-medium" style={{ color: "var(--color-text)" }}>
            No emails found
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Try a different search or filter
          </p>
        </div>
      ) : (
        <div className="space-y-4" role="feed" aria-label="Email list">
          {filtered.map((email, index) => (
            <EmailCard key={email.id} email={email} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
