import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding",
  description:
    "Answer a few questions and let an Azure AI Foundry model draft your agent's persona and pick its skills from the skills.sh registry.",
  alternates: { canonical: "/onboarding" },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
