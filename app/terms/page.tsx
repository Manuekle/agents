import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — creagent",
  description: "The terms that govern your use of creagent.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "The service",
    body: "creagent lets you compose AI agent definitions, save them to your account, and export them to tools like Claude Code, Codex and any MCP-capable model. The service is provided as-is, with no guarantee of availability.",
  },
  {
    title: "Your account",
    body: "Signing in uses GitHub OAuth through Supabase. You are responsible for keeping your GitHub account secure. Agents you save to an account are yours; anyone you share them with is your responsibility.",
  },
  {
    title: "Your content",
    body: "You keep ownership of the agents and prompts you create. By saving them to the service you grant us the limited right to store, process and serve them so the service works.",
  },
  {
    title: "Acceptable use",
    body: "You agree not to use the service to build or distribute agents that break laws, violate others' rights, or are used for spam, fraud or harm. We may remove content or suspend accounts that violate this.",
  },
  {
    title: "Fees and plans",
    body: "The service offers free and paid plans. Paid plans are billed through the platform that provides them, and the limits described on the Pricing page apply. We may change pricing with notice.",
  },
  {
    title: "No warranty",
    body: "The service is provided without warranty of any kind, express or implied. Agents generated are drafts; you are responsible for reviewing them before use.",
  },
  {
    title: "Liability",
    body: "To the maximum extent permitted by law, we are not liable for indirect, incidental or consequential damages arising from your use of the service.",
  },
  {
    title: "Changes",
    body: "We may update these terms as the service evolves. Material changes will be announced on this page. Continued use after a change means you accept the updated terms.",
  },
];

export default function TermsPage() {
  return (
    <div>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-pixel text-xs sm:text-sm mb-1">TERMS</h1>        <p className="mt-4 font-mono text-xs text-muted">
          Last updated: August 2026
        </p>

        <div className="mt-8 space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-sans font-bold text-base">{s.title}</h2>
              <p className="mt-1.5 font-mono text-xs text-ink-soft leading-relaxed">
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
