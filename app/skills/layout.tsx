import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skills",
  description: "Search the skills.sh registry and pick skills for your agent.",
};

export default function SkillsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
