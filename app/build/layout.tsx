import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build",
  description: "Compose an AI agent — system prompt, model, skills — and export it.",
};

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return children;
}
