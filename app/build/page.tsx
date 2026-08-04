"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Slider } from "@heroui/react";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { VendorMark } from "@/components/brands";
import {
  Panel,
  PixelButton,
  Badge,
  Field,
  TextInput,
  TextArea,
  Segmented,
  Select,
  SuccessCheck,
  ResizeBox,
} from "@/components/ui";
import { MASCOT_ORDER, MASCOTS, type MascotState } from "@/lib/mascot";
import { SkillBrowser } from "@/components/SkillBrowser";
import {
  TARGETS,
  agentRepos,
  modelsFor,
  type Agent,
  type AgentTarget,
  type PickedSkill,
} from "@/lib/types";
import { saveAgent, useAgents } from "@/lib/store";
import {
  exportAgent,
  installCommand,
  newProjectCommand,
  skillsManifest,
  agentSpecJson,
  mcpServeCommand,
} from "@/lib/export";
import { copyText } from "@/lib/copy";

const CONFETTI = 18;

// The tick is always in the DOM — it just sits at opacity 0 until `done`, so
// the button keeps one width and never reflows as the check draws itself in.
function CopyLabel({ done }: { done: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <SuccessCheck shown={done} size={10} />
      {done ? "Copied" : "Copy"}
    </span>
  );
}

function newAgent(): Agent {
  return {
    id: `agent-${Date.now().toString(36)}`,
    name: "Untitled Agent",
    role: "general assistant",
    systemPrompt: "You are a focused, pixel-precise engineering agent.",
    target: "claude-code",
    model: "claude-opus-5",
    temperature: 0.7,
    skills: [],
    mascot: "working",
    accent: "#f95c4b",
    createdAt: Date.now(),
  };
}

function Builder() {
  const params = useSearchParams();
  const router = useRouter();
  const agents = useAgents();
  const editId = params.get("id");

  const [agent, setAgent] = useState<Agent>(newAgent);
  const [saved, setSaved] = useState(false);
  const saveRef = useRef<HTMLSpanElement>(null);
  const confettiTimer = useRef<number | undefined>(undefined);
  // preview state driven by which field is active
  const [previewState, setPreviewState] = useState<MascotState>("working");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (editId) {
      const found = agents.find((a) => a.id === editId);
      if (found) setAgent(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, agents.length]);

  const set = <K extends keyof Agent>(k: K, v: Agent[K]) => {
    setAgent((a) => ({ ...a, [k]: v }));
    setSaved(false);
  };

  const toggleSkill = (s: PickedSkill) => {
    setAgent((a) => ({
      ...a,
      skills: a.skills.some((x) => x.id === s.id)
        ? a.skills.filter((x) => x.id !== s.id)
        : [...a.skills, s],
    }));
    setPreviewState("wizard");
    setSaved(false);
  };

  const output = useMemo(() => exportAgent(agent), [agent]);
  const install = useMemo(() => installCommand(agent), [agent]);
  const newProj = useMemo(() => newProjectCommand(agent), [agent]);
  const repos = agentRepos(agent);

  // Spray each piece on its own vector/rotation/tint so the burst reads as
  // confetti rather than a symmetric starburst.
  const fireConfetti = () => {
    const root = saveRef.current;
    if (!root) return;
    const tints = ["var(--coral)", "var(--coral-deep)", "var(--ink)", "var(--stone-deep)"];
    root.querySelectorAll<HTMLElement>(".t-confetti i").forEach((p, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const dist = 26 + Math.random() * 46;
      p.style.setProperty("--cx", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--cy", `${Math.sin(angle) * dist}px`);
      p.style.setProperty("--crot", `${Math.round((Math.random() - 0.5) * 540)}deg`);
      p.style.setProperty("--cdelay", `${Math.random() * 90}ms`);
      p.style.setProperty("--cbg", tints[i % tints.length]);
    });
    // Toggled on the node, not via state: React batches a false/true pair in
    // one handler into a single render, so the class never leaves the DOM and
    // the forwards-filled animation stays parked instead of replaying.
    root.classList.remove("is-confetti");
    void root.offsetWidth; // reflow, or re-adding the class is a no-op
    root.classList.add("is-confetti");
    window.clearTimeout(confettiTimer.current);
    confettiTimer.current = window.setTimeout(
      () => root.classList.remove("is-confetti"),
      1500,
    );
  };

  const doSave = () => {
    setPreviewState("cooking");
    saveAgent(agent);
    setSaved(true);
    fireConfetti();
    setTimeout(() => setPreviewState(agent.mascot), 900);
  };

  const copy = () => doCopy(output.content, "output");

  // One shared handler for every Copy button; only the winning key turns
  // green, and only when the text really landed on the clipboard.
  const doCopy = async (text: string, key: string) => {
    if (!(await copyText(text))) return;
    setCopiedKey(key);
    setPreviewState("rocket");
    setTimeout(() => setCopiedKey(null), 1600);
    setTimeout(() => setPreviewState(agent.mascot), 900);
  };

  const download = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setPreviewState("rocket");
    setTimeout(() => setPreviewState(agent.mascot), 900);
  };
  const downloadManifest = () => download("agents-dev.skills.json", skillsManifest(agent));
  const downloadAgent = () => download("agents-dev.agent.json", agentSpecJson(agent));

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Stacks below `sm`: the Silkscreen title and both buttons cannot
            share a 375px row without colliding. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-pixel text-xs sm:text-sm mb-1">AGENT_COMPOSER</h1>
            <PoweredBy />
          </div>
          <div className="flex gap-2">
            <PixelButton variant="ghost" onClick={() => router.push("/")}>
              ← Home
            </PixelButton>
            <span ref={saveRef} className="relative inline-flex">
              <PixelButton variant="coral" onClick={doSave}>
                <span className="inline-flex items-center gap-1.5">
                  <SuccessCheck shown={saved} size={12} />
                  {saved ? "Saved" : "Save agent"}
                </span>
              </PixelButton>
              <span className="t-confetti" aria-hidden>
                {Array.from({ length: CONFETTI }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
            </span>
          </div>
        </div>

        {/* min-w-0 on both columns: grid items default to min-width:auto, so the
            export <pre> and the nowrap install <code> below size the track to
            their own max-content and push the whole page into horizontal scroll
            on phones. */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* FORM */}
          <div className="space-y-5 min-w-0">
            <Panel className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Name">
                  <TextInput
                    value={agent.name}
                    onFocus={() => setPreviewState("thinking")}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Role">
                  <TextInput
                    value={agent.role}
                    onFocus={() => setPreviewState("thinking")}
                    onChange={(e) => set("role", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="System prompt" hint={`${agent.systemPrompt.length} chars`}>
                <TextArea
                  rows={5}
                  value={agent.systemPrompt}
                  onFocus={() => setPreviewState("working")}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                />
              </Field>
            </Panel>

            <Panel className="p-5 space-y-4">
              <Field label="Target tool" hint={TARGETS.find((t) => t.id === agent.target)?.hint}>
                <Segmented<AgentTarget>
                  options={TARGETS.map((t) => ({ id: t.id, label: t.label }))}
                  value={agent.target}
                  onChange={(v) => {
                    // Switching tools can strand the model on one the new tool
                    // can't run (Opus 5 under Gemini CLI), so fall back to the
                    // new tool's first option when that happens.
                    const allowed = modelsFor(v);
                    setAgent((a) => ({
                      ...a,
                      target: v,
                      model: allowed.some((m) => m.id === a.model) ? a.model : allowed[0].id,
                    }));
                    setSaved(false);
                  }}
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Model">
                  <Select
                    options={modelsFor(agent.target).map((m) => ({
                      id: m.id,
                      label: m.label,
                      hint: m.vendor,
                      icon: <VendorMark vendor={m.vendor} />,
                    }))}
                    value={agent.model}
                    onChange={(v) => set("model", v)}
                  />
                </Field>
                <Field label="Temperature" hint={agent.temperature.toFixed(2)}>
                  <Slider
                    aria-label="Temperature"
                    className="heroui-brand w-full"
                    maxValue={1}
                    minValue={0}
                    step={0.05}
                    value={agent.temperature}
                    onChange={(v) => set("temperature", Array.isArray(v) ? v[0] : v)}
                  >
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                </Field>
              </div>
            </Panel>

            {/* MASCOT PICKER */}
            <Panel className="p-5">
              <Field label="Mascot" hint="state animation on the card">
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-1">
                  {MASCOT_ORDER.map((s) => (
                    <button
                      key={s}
                      title={MASCOTS[s].label}
                      onClick={() => {
                        set("mascot", s);
                        setPreviewState(s);
                      }}
                      className={`mascot-stage relative overflow-hidden aspect-square grid place-items-center border-2 transition-all ${
                        agent.mascot === s
                          ? "border-coral shadow-[0_0_0_2px_var(--coral)]"
                          : "border-line hover:border-ink-soft"
                      }`}
                    >
                      <Mascot state={s} size={40} />
                    </button>
                  ))}
                </div>
              </Field>
            </Panel>

            {/* SKILLS — live search of skills.sh */}
            <Panel className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-pixel text-[10px] uppercase">Skills · skills.sh</span>
                <Badge tone="coral">{agent.skills.length} selected</Badge>
              </div>

              {agent.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {agent.skills.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleSkill(s)}
                      title={`remove ${s.repo}`}
                      className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border-2 border-line bg-fill text-on-fill hover:bg-coral transition-colors"
                    >
                      {s.name} <span className="opacity-70">✕</span>
                    </button>
                  ))}
                </div>
              )}

              <SkillBrowser selected={agent.skills} onToggle={toggleSkill} />
            </Panel>
          </div>

          {/* PREVIEW / EXPORT */}
          <div className="space-y-5 min-w-0 lg:sticky lg:top-20 self-start">
            <Panel className="p-5 text-center">
              <div className="grain mascot-stage relative pixel-border-sm p-5 overflow-hidden">
                <Mascot state={previewState} size={104} />
              </div>
              <div className="mt-3 font-sans font-bold truncate">{agent.name}</div>
              <div className="font-mono text-[11px] text-muted truncate">{agent.role}</div>
              <div className="flex items-center justify-center gap-1.5 mt-2 font-mono text-[10px] text-muted dots">
                <span>{MASCOTS[previewState].blurb}</span>
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-line bg-stone">
                <span className="font-mono text-[11px]">{output.filename}</span>
                <PixelButton
                  onClick={copy}
                  className={`!px-2 !py-1 !text-[9px] ${copiedKey === "output" ? "!bg-ok !text-paper" : ""}`}
                >
                  <CopyLabel done={copiedKey === "output"} />
                </PixelButton>
              </div>
              {/* Switching target tool swaps a long CLAUDE.md for a short
                  mcp.json — tweening the box keeps the sidebar from jumping. */}
              <ResizeBox max={420}>
                <pre className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
                  {output.content}
                </pre>
              </ResizeBox>
            </Panel>

            {/* INSTALL — wraps the official skills CLI */}
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-line bg-coral text-paper">
                <span className="font-pixel text-[10px] uppercase">Install</span>
                <Badge tone="ink">{repos.length} repos</Badge>
              </div>
              <div className="p-3 space-y-3">
                <div>
                  <div className="font-mono text-[9px] uppercase text-muted mb-1">existing project</div>
                  <div className="flex items-stretch gap-1.5">
                    <code className="flex-1 min-w-0 bg-stone border-2 border-line px-2 py-1.5 font-mono text-[10px] overflow-auto whitespace-nowrap">
                      {install}
                    </code>
                    <PixelButton
                      onClick={() => doCopy(install, "install")}
                      disabled={repos.length === 0}
                      className={`!px-2 !py-1 !text-[9px] shrink-0 ${copiedKey === "install" ? "!bg-ok !text-paper" : ""}`}
                    >
                      <CopyLabel done={copiedKey === "install"} />
                    </PixelButton>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[9px] uppercase text-muted mb-1">new project</div>
                  <div className="flex items-stretch gap-1.5">
                    <code className="flex-1 min-w-0 bg-stone border-2 border-line px-2 py-1.5 font-mono text-[10px] overflow-auto whitespace-nowrap">
                      {newProj}
                    </code>
                    <PixelButton
                      onClick={() => doCopy(newProj, "newproj")}
                      className={`!px-2 !py-1 !text-[9px] shrink-0 ${copiedKey === "newproj" ? "!bg-ok !text-paper" : ""}`}
                    >
                      <CopyLabel done={copiedKey === "newproj"} />
                    </PixelButton>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <PixelButton
                    variant="ghost"
                    onClick={downloadManifest}
                    disabled={repos.length === 0}
                    className="w-full"
                  >
                    ↓ .skills.json
                  </PixelButton>
                  <PixelButton variant="ghost" onClick={downloadAgent} className="w-full">
                    ↓ agent.json
                  </PixelButton>
                </div>
                <p className="font-mono text-[9px] text-muted leading-relaxed">
                  Uses the official <b>skills</b> CLI — auto-detects your agent (Claude
                  Code, Cursor, Codex…) and writes into its skills dir.
                </p>

                {/* serve the agent over MCP to any model */}
                <div className="pt-2 border-t-2 border-line">
                  <div className="font-mono text-[9px] uppercase text-muted mb-1">serve over MCP</div>
                  <div className="flex items-stretch gap-1.5">
                    <code className="flex-1 min-w-0 bg-stone border-2 border-line px-2 py-1.5 font-mono text-[10px] overflow-auto whitespace-nowrap">
                      {mcpServeCommand()}
                    </code>
                    <PixelButton
                      onClick={() => doCopy(mcpServeCommand(), "mcp")}
                      className={`!px-2 !py-1 !text-[9px] shrink-0 ${copiedKey === "mcp" ? "!bg-ok !text-paper" : ""}`}
                    >
                      <CopyLabel done={copiedKey === "mcp"} />
                    </PixelButton>
                  </div>
                  <p className="font-mono text-[9px] text-muted leading-relaxed mt-1.5">
                    Drop <b>agent.json</b> in your repo, add the line to any MCP client —
                    serves this agent&apos;s prompt + skills to Claude, GPT, Gemini…
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense fallback={<div className="p-10 font-mono text-sm">loading composer…</div>}>
      <Builder />
    </Suspense>
  );
}
