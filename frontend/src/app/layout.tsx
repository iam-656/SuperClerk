// ─────────────────────────────────────────────────────────────
// SuperClerk — Root Layout
// ─────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { auth } from "@/auth";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SuperClerk — AI OS for Small Businesses",
    template: "%s | SuperClerk",
  },
  description:
    "SuperClerk is your AI-powered operating system — reads emails, plans actions, and automates routine business operations with human oversight.",
  keywords: ["AI", "email automation", "small business", "Gmail", "productivity"],
  authors: [{ name: "SuperClerk Team" }],
  openGraph: {
    title: "SuperClerk — AI OS for Small Businesses",
    description: "Automate routine operations with intelligent AI employees.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="h-full antialiased">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
