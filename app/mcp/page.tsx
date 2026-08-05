"use client";

import { useMemo, useState } from "react";
import { PoweredBy } from "@/components/PoweredBy";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge } from "@/components/ui";
import { McpTokens } from "@/components/McpTokens";
import { copyText } from "@/lib/copy";

// What @manudev.jsx/agents exposes once connected.
const PRIMITIVES = [
  { kind: "prompt", name: "activate_agent", desc: "the orchestrator persona + its delegation roster" },
  { kind: "prompt", name: "activate_subagent", desc: "one specialist's persona, by name" },
  { kind: "resource", name: "agent://spec", desc: "full agent spec JSON" },
  { kind: "resource", name: "agent://skills", desc: "every component in the graph, flat" },
  { kind: "resource", name: "agent://subagents", desc: "the delegation tree" },
  { kind: "tool", name: "agent_info", desc: "name / role / model / temperature / counts" },
  { kind: "tool", name: "list_skills", desc: "components, scopable to one agent" },
  { kind: "tool", name: "list_subagents", desc: "the specialists and what each carries" },
  { kind: "tool", name: "system_prompt", desc: "a raw system prompt, root or specialist" },
];

// The v2 spec the composer now writes. Version 1 was a single persona and a
// flat `skills` array; the canvas made an agent a tree, so the file grew an
// `orchestrator` and a `subagents` list. `skills` is unchanged and still holds
// every component in the graph, so a server that only knows v1 keeps working —
// it just serves the root persona and none of the delegation.
const SPEC_SHAPE = `{
  "version": 2,
  "name": "Release Captain",
  "role": "ships the release",
  "model": "claude-opus-5",
  "temperature": 0.7,
  "system": "You own the release. Delegate, do not do it all yourself.",

  // every component in the graph, flat — what the installers read
  "skills": [
    { "name": "Vercel React Best Practices",
      "kind": "skills", "repo": "vercel-labs/agent-skills" }
  ],

  // the root persona and the components it holds itself
  "orchestrator": {
    "name": "Release Captain",
    "role": "ships the release",
    "model": "claude-opus-5",
    "temperature": 0.7,
    "system": "…",
    "skills": []
  },

  // one entry per specialist, flattened, each naming its parent
  "subagents": [
    {
      "name": "Reviewer",
      "role": "reads every diff",
      "model": "claude-opus-5",
      "temperature": 0.2,
      "system": "You review diffs. Be specific.",
      "parent": "Release Captain",
      "depth": 1,
      "skills": [
        { "name": "Security Review",
          "kind": "skills", "repo": "getsentry/skills" }
      ]
    }
  ]
}`;

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
                prompt, its skills and its subagents — over MCP, so <i>any</i>{" "}
                MCP-capable client can load it. Export <b>agent.json</b> from the
                composer, drop it in your repo, add the config, done.
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
                          ? "bg-coral-text text-paper"
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

            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-line bg-stone">
                <span className="font-mono text-[11px]">agents-dev.agent.json</span>
                <Badge tone="coral">v2</Badge>
              </div>
              <pre className="p-4 text-[10px] font-mono leading-relaxed overflow-auto">
                {SPEC_SHAPE}
              </pre>
              <div className="px-4 py-3 border-t-2 border-line dither-stone space-y-1">
                <p className="font-mono text-[10px] text-ink">
                  The composer&apos;s canvas writes <b>orchestrator</b> and{" "}
                  <b>subagents</b>. A server reading only <b>skills</b> still works —
                  that field is unchanged and still holds every component.
                </p>
                <p className="font-mono text-[10px] text-ink">
                  Fetched over a token, <code>/api/mcp/agent</code> returns this exact
                  shape, so a file and an account serve the same spec.
                </p>
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
    </div>
  );
}
