import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New agent",
  description:
    "Start an AI agent two ways — a guided onboarding that drafts the persona for you, or the manual composer.",
  alternates: { canonical: "/new" },
};

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
