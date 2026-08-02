"use client";

import { useMemo, useState } from "react";
import { Nav, PoweredBy } from "@/components/Nav";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge, Field, TextInput } from "@/components/ui";
import { MODELS } from "@/lib/types";

// A tiny MCP bridge config generator — one server, many models.
export default function McpPage() {
  const [name, setName] = useState("agent-forge-bridge");
  const [selected, setSelected] = useState<string[]>(["claude-opus-4-8", "gpt-5-codex"]);
  const [copied, setCopied] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const config = useMemo(() => {
    return JSON.stringify(
      {
        mcpServers: {
          [name]: {
            command: "npx",
            args: ["-y", "@agent-forge/mcp"],
            env: { AGENT_FORGE_MODELS: selected.join(",") },
          },
        },
      },
      null,
      2,
    );
  }, [name, selected]);

  const copy = () => {
    navigator.clipboard?.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-pixel text-sm mb-1">MCP_BRIDGE</h1>
            <PoweredBy />
          </div>
          <Mascot state="headphones" size={44} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <Panel className="p-5">
              <Field label="Server name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-pixel text-[10px] uppercase">Route models</span>
                <Badge tone="coral">{selected.length} active</Badge>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {MODELS.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={`text-left p-3 border-2 border-ink transition-all ${
                        on ? "bg-ink text-paper" : "bg-paper hover:shadow-[2px_2px_0_0_var(--coral)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{m.label}</span>
                        <span className="font-pixel text-[9px]">{on ? "[x]" : "[ ]"}</span>
                      </div>
                      <span className={`font-mono text-[10px] ${on ? "text-stone" : "text-muted"}`}>
                        {m.vendor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <Panel className="overflow-hidden self-start">
            <div className="flex items-center justify-between px-3 py-2 border-b-2 border-ink bg-stone">
              <span className="font-mono text-[11px]">mcp.json</span>
              <PixelButton onClick={copy} className="!px-2 !py-1 !text-[9px]">
                {copied ? "Copied ✓" : "Copy"}
              </PixelButton>
            </div>
            <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-auto whitespace-pre-wrap">
              {config}
            </pre>
            <div className="px-4 py-3 border-t-2 border-ink dither-stone">
              <p className="font-mono text-[10px] text-ink">
                Drop into <b>.mcp.json</b> or <b>~/.claude/</b> — one bridge, every model.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
