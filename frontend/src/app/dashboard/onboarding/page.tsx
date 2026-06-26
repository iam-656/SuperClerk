// ─────────────────────────────────────────────────────────────
// SuperClerk — User Onboarding Page
// Shown to first-time users after Google sign-in.
// ─────────────────────────────────────────────────────────────

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Mail,
  Brain,
  CheckCircle,
  ArrowRight,
  Layers,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Mail,
    title: "Gmail Automation",
    description:
      "SuperClerk reads your inbox, understands context, and drafts intelligent replies.",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    icon: Brain,
    title: "AI Decision Engine",
    description:
      "Gemini AI analyses every email and proposes the best action — categorised and prioritised.",
    color: "#6366F1",
    bg: "#EEF2FF",
  },
  {
    icon: CheckCircle,
    title: "Human Approval",
    description:
      "You review and approve every action before it executes. You are always in control.",
    color: "#10B981",
    bg: "#F0FDF4",
  },
  {
    icon: Zap,
    title: "Instant Execution",
    description:
      "Once approved, actions execute in seconds — replies sent, tasks created, items archived.",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  const user = session?.user;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: "var(--color-surface)" }}>
      <div className="w-full max-w-2xl animate-fade-in-up space-y-10">

        {/* Header */}
        <div className="text-center space-y-4">
          <div
            className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mx-auto shadow-lg"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
          >
            <Layers size={32} color="white" />
          </div>

          <div className="space-y-2">
            <h1
              className="text-3xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              Welcome to SuperClerk, {firstName}! 👋
            </h1>
            <p
              className="text-base leading-relaxed max-w-md mx-auto"
              style={{ color: "var(--color-text-muted)" }}
            >
              Your AI-powered business operating system is ready. Here&apos;s what
              SuperClerk will do for you:
            </p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description, color, bg }) => (
            <div
              key={title}
              className="rounded-xl p-5 space-y-3 transition-transform hover:scale-[1.02]"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={20} color={color} />
              </div>
              <div>
                <p
                  className="font-semibold text-sm"
                  style={{ color: "var(--color-text)" }}
                >
                  {title}
                </p>
                <p
                  className="text-sm leading-relaxed mt-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <button
            id="btn-start-dashboard"
            onClick={() => router.push("/dashboard")}
            className="btn btn-primary gap-2 px-8 py-3 text-base"
          >
            Go to Dashboard
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Footer note */}
        <p
          className="text-center text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          SuperClerk will always ask for your approval before taking any action.
        </p>
      </div>
    </div>
  );
}
