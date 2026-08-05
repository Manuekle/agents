import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Watch an agent get composed end to end — brief, persona, skills, specialists, export — on pre-loaded data. No account, nothing saved.",
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
