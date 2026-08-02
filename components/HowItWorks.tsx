"use client";

import { useEffect, useState } from "react";
import { Panel, Badge } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { clsx } from "@/lib/clsx";
import type { MascotState } from "@/lib/mascot";

type StepKey = "compose" | "skills" | "install" | "mcp";

const STEPS: { key: StepKey; label: string; mascot: MascotState; blurb: string }[] = [
  { key: "compose", label: "Compose", mascot: "working", blurb: "Name it, set the system prompt & model" },
  { key: "skills", label: "Add skills", mascot: "wizard", blurb: "Search skills.sh, pick owner/repo" },
  { key: "install", label: "Install", mascot: "rocket", blurb: "Run npx skills add in your project" },
  { key: "mcp", label: "Serve MCP", mascot: "headphones", blurb: "Expose it to any model over MCP" },
];

const PROMPT = "You review diffs for correctness and clarity. Terse, severity-tagged findings.";

function useTypewriter(text: string, active: boolean, speed = 22) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (!active) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return text.slice(0, n);
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-pixel text-[9px] uppercase mb-1">{label}</div>
      <div className="bg-paper border-2 border-line px-2.5 py-1.5 font-mono text-[11px] min-h-[30px]">
        {children}
      </div>
    </div>
  );
}

function Compose({ active }: { active: boolean }) {
  const typed = useTypewriter(PROMPT, active);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MiniField label="Name">Pixel Reviewer</MiniField>
        <MiniField label="Role">a meticulous code reviewer</MiniField>
      </div>
      <MiniField label="System prompt">
        {typed}
        {active && <span className="caret" />}
      </MiniField>
      <div className="grid grid-cols-2 gap-3">
        <MiniField label="Model">Opus 4.8 · Anthropic</MiniField>
        <MiniField label="Target">Claude Code</MiniField>
      </div>
    </div>
  );
}

const DEMO_SKILLS = [
  { name: "Vercel React Best Practices", repo: "vercel-labs/agent-skills" },
  { name: "Security Review", repo: "anthropics/skills" },
  { name: "Transitions", repo: "gstack/skills" },
];

function Skills() {
  return (
    <div className="space-y-3">
      <div className="bg-paper border-2 border-line px-2.5 py-1.5 font-mono text-[11px] flex items-center justify-between">
        <span>react</span>
        <span className="text-muted">skills.sh ↵</span>
      </div>
      <div className="space-y-2">
        {DEMO_SKILLS.map((s, i) => (
          <div
            key={s.repo}
            className="pop-in flex items-center justify-between gap-2 p-2 border-2 border-line bg-fill text-on-fill"
            style={{ animationDelay: `${i * 260}ms` }}
          >
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-bold truncate">{s.name}</div>
              <div className="font-mono text-[9px] text-on-fill-muted truncate">{s.repo}</div>
            </div>
            <span className="font-pixel text-[9px] shrink-0">[x]</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ file, children }: { file: string; children: React.ReactNode }) {
  return (
    <div className="pop-in border-2 border-line">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b-2 border-line bg-stone">
        <span className="font-mono text-[10px]">{file}</span>
        <span className="font-pixel text-[8px] uppercase bg-fill text-on-fill px-1.5 py-0.5">copy</span>
      </div>
      <pre className="p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap overflow-auto">{children}</pre>
    </div>
  );
}

function Install() {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[9px] uppercase text-muted">existing project</div>
      <CodeBlock file="terminal">npx skills add vercel-labs/agent-skills anthropics/skills</CodeBlock>
      <div className="font-mono text-[9px] uppercase text-muted">new project</div>
      <CodeBlock file="terminal">
        npx create-next-app@latest my-agent-app --yes{"\n"}  &amp;&amp; cd my-agent-app{"\n"}  &amp;&amp; npx skills add …
      </CodeBlock>
    </div>
  );
}

function Mcp() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {["activate_agent", "agent://spec", "agent_info", "list_skills"].map((p) => (
          <Badge key={p}>{p}</Badge>
        ))}
      </div>
      <CodeBlock file="mcp.json">
        {`{
  "mcpServers": {
    "agents-dev": {
      "command": "npx",
      "args": ["-y", "@agents-dev/mcp",
               "--agent", "./agents-dev.agent.json"]
    }
  }
}`}
      </CodeBlock>
    </div>
  );
}

export function HowItWorks() {
  const [step, setStep] = useState(0);

  // auto-advance; resets when the user clicks a step
  useEffect(() => {
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 3600);
    return () => clearTimeout(id);
  }, [step]);

  const s = STEPS[step];

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      {/* animated demo panel — re-mounts per step to replay animations */}
      <Panel className="p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Badge tone="coral">
            {step + 1}/{STEPS.length}
          </Badge>
          <span className="font-pixel text-[10px] uppercase">{s.label}</span>
        </div>
        <div key={step} className="min-h-[240px]">
          {s.key === "compose" && <Compose active />}
          {s.key === "skills" && <Skills />}
          {s.key === "install" && <Install />}
          {s.key === "mcp" && <Mcp />}
        </div>
      </Panel>

      {/* mascot + step nav */}
      <div className="space-y-4">
        <Panel className="p-4 text-center">
          <div className="grain mascot-stage relative pixel-border-sm p-4 overflow-hidden">
            <Mascot state={s.mascot} size={84} />
          </div>
          <div className="mt-3 font-mono text-[11px] text-muted leading-snug">{s.blurb}</div>
        </Panel>

        <div className="space-y-1.5">
          {STEPS.map((st, i) => (
            <button
              key={st.key}
              onClick={() => setStep(i)}
              className={clsx(
                "w-full text-left flex items-center gap-2 px-3 py-2 border-2 border-line transition-colors",
                i === step ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
              )}
            >
              <span
                className={clsx(
                  "w-4 h-4 grid place-items-center font-pixel text-[9px] border-2 border-line shrink-0",
                  i === step ? "bg-coral text-paper" : "bg-paper",
                )}
              >
                {i + 1}
              </span>
              <span className="font-mono text-xs">{st.label}</span>
              {i === step && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-coral animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
