// ─────────────────────────────────────────────────────────────
// SuperClerk — Auth / Landing Page
// Split-layout: branding left, sign-in right
// ─────────────────────────────────────────────────────────────

import { Metadata } from "next";
import { SignInButton } from "@/components/auth/SignInButton";

export const metadata: Metadata = {
  title: "Welcome to SuperClerk",
  description: "Sign in with Google to access your AI-powered business assistant.",
};

export default function AuthPage() {
  return (
    <main className="min-h-screen flex">
      {/* ── Left Panel — Branding ─────────────────────── */}
      <div
        className="hidden lg:flex lg:flex-col lg:justify-between lg:w-[55%] relative overflow-hidden p-12"
        style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 50%, #4C1D95 100%)" }}
      >
        {/* Background decoration */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #A78BFA 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, #C4B5FD 0%, transparent 40%),
                              radial-gradient(circle at 60% 80%, #7C3AED 0%, transparent 40%)`,
          }}
        />

        {/* Floating orbs */}
        <div
          className="absolute top-20 right-20 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #FFFFFF, transparent)" }}
        />
        <div
          className="absolute bottom-32 left-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #C4B5FD, transparent)" }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">SuperClerk</span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-dot" />
              <span className="text-white/90 text-sm font-medium">AI Agents Running</span>
            </div>
            <h1 className="text-5xl font-bold text-white leading-tight">
              Your AI-Powered<br />
              <span className="text-purple-200">Business OS</span>
            </h1>
            <p className="text-purple-100 text-lg leading-relaxed max-w-sm">
              SuperClerk reads your emails, plans intelligent actions, and executes them — always with your approval.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {[
              "📧 Gmail Automation",
              "🤖 AI Decision Making",
              "✅ Human Approval",
              "📊 Activity Timeline",
            ].map((feature) => (
              <span
                key={feature}
                className="bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm px-4 py-2 rounded-full"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Testimonial / tagline */}
        <div className="relative z-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <p className="text-white/90 text-sm leading-relaxed italic">
            &ldquo;Finally, an AI that understands my business context and asks before acting.&rdquo;
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-300 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
            <div>
              <p className="text-white text-sm font-medium">Ali — CEO, SuperClerk</p>
              <p className="text-white/60 text-xs">Early Adopter</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel — Sign In ─────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-10 animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-semibold text-xl" style={{ color: "var(--color-text)" }}>SuperClerk</span>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2
              className="text-3xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              Welcome back
            </h2>
            <p style={{ color: "var(--color-text-muted)" }} className="text-base">
              Sign in to access your AI business assistant
            </p>
          </div>

          {/* Sign in card */}
          <div className="space-y-6">
            <SignInButton />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "var(--color-border)" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white" style={{ color: "var(--color-text-muted)" }}>
                  Secure sign-in via Google
                </span>
              </div>
            </div>

            {/* What Google provides */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                SuperClerk will request access to:
              </p>
              {[
                { icon: "✉️", text: "Read your Gmail inbox" },
                { icon: "📤", text: "Send emails on your behalf" },
                { icon: "👤", text: "Your name and profile photo" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-sm">{icon}</span>
                  <span className="text-sm" style={{ color: "var(--color-text)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
            By signing in, you agree to SuperClerk&apos;s{" "}
            <a href="#" className="underline" style={{ color: "var(--color-primary)" }}>
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline" style={{ color: "var(--color-primary)" }}>
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
