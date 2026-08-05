"use client";

import { useMemo, useState } from "react";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge } from "@/components/ui";
import { McpTokens } from "@/components/McpTokens";
import { copyText } from "@/lib/copy";

// What @manudev.jsx/agents exposes once connected.
const PRIMITIVES = [
  { kind: "prompt", name: "activate_agent", desc: "injects the agent persona + skill context" },
  { kind: "resource", name: "agent://spec", desc: "full agent spec JSON" },
  { kind: "resource", name: "agent://skills", desc: "picked skills (name + owner/repo)" },
  { kind: "tool", name: "agent_info", desc: "name / role / model / temperature" },
  { kind: "tool", name: "list_skills", desc: "the agent's skills" },
  { kind: "tool", name: "system_prompt", desc: "the raw system prompt" },
];

const CLIENTS = ["Claude Desktop", "Claude Code", "Cursor", "Codex", "Windsurf", "Cline", "Gemini"];

export default function McpPage() {
  const [copied, setCopied] = useState(false);

  const config = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            "agents-dev": {
              command: "npx",
              args: ["-y", "@manudev.jsx/agents", "--agent", "./agents-dev.agent.json"],
            },
          },
        },
        null,
        2,
      ),
    [],
  );

  const copy = async () => {
    if (await copyText(config)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-pixel text-sm mb-1">MCP_SERVER</h1>
            <PoweredBy />
          </div>
          <Mascot state="headphones" size={44} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <Panel className="p-5">
              <p className="font-mono text-xs text-ink-soft leading-relaxed">
                <b>@manudev.jsx/agents</b> serves an agent you composed — its system
                prompt and skills — over MCP, so <i>any</i> MCP-capable client can
                load it. Export <b>agent.json</b> from the composer, drop it in your
                repo, add the config, done.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {CLIENTS.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-pixel text-[10px] uppercase">Exposes</span>
                <Badge tone="coral">{PRIMITIVES.length} primitives</Badge>
              </div>
              <div className="space-y-2">
                {PRIMITIVES.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 p-2 border-2 border-line bg-paper">
                    <span
                      className={`font-pixel text-[8px] uppercase px-1.5 py-0.5 border-2 border-line shrink-0 ${
                        p.kind === "tool"
                          ? "bg-coral text-paper"
                          : p.kind === "prompt"
                            ? "bg-fill text-on-fill"
                            : "bg-stone text-ink"
                      }`}
                    >
                      {p.kind}
                    </span>
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold truncate">{p.name}</div>
                      <div className="font-mono text-[10px] text-muted">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-5 self-start min-w-0">
            <McpTokens />

            <Panel className="overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b-2 border-line bg-stone">
              <span className="font-mono text-[11px]">mcp.json</span>
              <PixelButton
                onClick={copy}
                className={`!px-2 !py-1 !text-[9px] ${copied ? "!bg-ok !text-paper" : ""}`}
              >
                {copied ? "Copied ✓" : "Copy"}
              </PixelButton>
            </div>
            <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-auto whitespace-pre-wrap">
              {config}
            </pre>
            <div className="px-4 py-3 border-t-2 border-line dither-stone space-y-1">
              <p className="font-mono text-[10px] text-ink">
                Add to <b>.mcp.json</b>, <b>~/.claude/</b> or your client&apos;s MCP
                config, alongside <b>agents-dev.agent.json</b>.
              </p>
              <p className="font-mono text-[10px] text-ink">
                Then call the <b>activate_agent</b> prompt to load the persona.
              </p>
            </div>
            </Panel>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
