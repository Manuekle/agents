"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { AgentCanvas } from "@/components/canvas/AgentCanvas";
import { Panel, PixelButton, Badge, ResizeBox } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { MASCOTS } from "@/lib/mascot";
import { TARGETS } from "@/lib/types";
import { subagentsOf } from "@/lib/graph";
import { exportAgent, installCommand } from "@/lib/export";
import {
  DEMO_BRIEF,
  DEMO_CANDIDATES,
  DEMO_SEARCH_TERMS,
  DEMO_STEPS,
  demoAgentAt,
  demoGraphAt,
} from "@/lib/demo-agent";

// The one thing a visitor without an account can do.
//
// It is a simulation, not a trial: the graph, the export and the install line
// are produced by the same code the composer runs, but nothing is drafted,
// fetched or saved. There is no localStorage write and no API call on this
// page — which is the whole reason it can be public while /build is not.

const STEP_MS = 5200;

/** Types `text` out once per `runId`. Instant when the viewer prefers that. */
function useTypewriter(text: string, runId: number, speed = 14) {
  const [n, setN] = useState(text.length);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
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
  }, [text, runId, speed]);

  return text.slice(0, n);
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-pixel text-[9px] uppercase mb-1 text-muted">{label}</div>
      <div className="bg-paper border-2 border-line px-2.5 py-1.5 font-mono text-[11px] min-h-[30px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ---- the five panels -------------------------------------------------------

function BriefPanel({ runId }: { runId: number }) {
  const typed = useTypewriter(DEMO_BRIEF.purpose, runId);
  return (
    <div className="space-y-3">
      <Line label="What should this agent do?">
        {typed}
        <span className="caret" />
      </Line>
      <div className="grid sm:grid-cols-2 gap-3">
        <Line label="Domain / stack">{DEMO_BRIEF.domain}</Line>
        <Line label="Team / project">{DEMO_BRIEF.teamName}</Line>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Line label="Tone">{DEMO_BRIEF.tone}</Line>
        <Line label="Target tool">
          {TARGETS.find((t) => t.id === DEMO_BRIEF.target)?.label ?? DEMO_BRIEF.target}
        </Line>
      </div>
    </div>
  );
}

function PersonaPanel({ runId }: { runId: number }) {
  const agent = demoAgentAt(1);
  const typed = useTypewriter(agent.systemPrompt, runId);
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Line label="Name">{agent.name}</Line>
        <Line label="Role">{agent.role}</Line>
      </div>
      <Line label="System prompt">
        <span className="whitespace-pre-wrap">{typed}</span>
        <span className="caret" />
      </Line>
      <div className="grid sm:grid-cols-2 gap-3">
        <Line label="Model">{agent.model}</Line>
        <Line label="Temperature">{agent.temperature.toFixed(2)}</Line>
      </div>
    </div>
  );
}

function SkillsPanel() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DEMO_SEARCH_TERMS.map((t) => (
          <span
            key={t}
            className="font-mono text-[10px] px-2 py-0.5 border-2 border-line bg-paper"
          >
            {t}
          </span>
        ))}
        <span className="font-mono text-[10px] text-muted self-center">→ skills.sh</span>
      </div>
      <div className="space-y-2">
        {DEMO_CANDIDATES.map((c, i) => (
          <div
            key={c.repo}
            style={{ animationDelay: `calc(var(--stagger-stagger) * ${i})` }}
            className={clsx(
              "pop-in flex items-center justify-between gap-2 p-2 border-2 border-line",
              c.picked ? "bg-fill text-on-fill" : "bg-paper",
            )}
          >
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-bold truncate">{c.name}</div>
              <div
                className={clsx(
                  "font-mono text-[9px] truncate",
                  c.picked ? "text-on-fill-muted" : "text-muted",
                )}
              >
                {c.repo}
              </div>
            </div>
            <span className="font-pixel text-[9px] shrink-0">{c.picked ? "[x]" : "[ ]"}</span>
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] text-muted leading-relaxed">
        Five came back, three were picked. The model chooses by index out of the
        live results rather than naming repos from memory — an invented{" "}
        <code>owner/repo</code> is an install command that cannot resolve.
      </p>
    </div>
  );
}

function DelegatePanel() {
  const graph = demoGraphAt(3);
  const specialists = subagentsOf(graph);
  return (
    <div className="space-y-2">
      {specialists.map((s, i) => (
        <div
          key={s.id}
          style={{ animationDelay: `calc(var(--stagger-stagger) * ${i})` }}
          className="pop-in flex gap-3 items-start p-3 border-2 border-line bg-paper"
        >
          <div className="mascot-stage relative overflow-hidden pixel-border-sm p-1.5 shrink-0">
            <Mascot state={s.mascot ?? "thinking"} size={40} />
          </div>
          <div className="min-w-0">
            <div className="font-sans font-bold text-sm">{s.name}</div>
            <div className="font-mono text-[10px] text-muted">{s.role}</div>
            <p className="font-mono text-[10px] text-ink-soft mt-1 leading-relaxed">
              {s.systemPrompt}
            </p>
          </div>
        </div>
      ))}
      <p className="font-mono text-[10px] text-muted leading-relaxed">
        Each specialist keeps its own model, temperature and components — the
        reviewer runs cold at 0.20, the test runner on a cheaper model.
      </p>
    </div>
  );
}

function ExportPanel() {
  const agent = demoAgentAt(4);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {TARGETS.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "p-2 border-2 border-line",
              t.id === agent.target ? "bg-fill text-on-fill" : "bg-paper",
            )}
          >
            <div className="font-mono text-[11px] font-bold">{t.label}</div>
            <div
              className={clsx(
                "font-mono text-[9px]",
                t.id === agent.target ? "text-on-fill-muted" : "text-muted",
              )}
            >
              {t.hint}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="font-pixel text-[9px] uppercase mb-1 text-muted">install</div>
        <code className="block bg-stone border-2 border-line px-2 py-1.5 font-mono text-[10px] overflow-auto whitespace-nowrap">
          {installCommand(agent)}
        </code>
      </div>
      <p className="font-mono text-[10px] text-muted leading-relaxed">
        The panel on the right is the real file, generated from the graph above
        by the same code the composer uses. Sign in and it is yours to edit,
        save and serve over MCP.
      </p>
    </div>
  );
}

// ---- the page --------------------------------------------------------------

function Demo() {
  const params = useSearchParams();
  // Set by proxy.ts when it turned someone away from a gated page, so the
  // sign-in below can put them back where they were going.
  const raw = params.get("from");
  const from = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Bumped whenever a step is entered, so the typewriters restart on a replay
  // of the same step rather than sitting there already finished.
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setStep((s) => (s + 1) % DEMO_STEPS.length);
      setRunId((n) => n + 1);
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [playing, step]);

  const goTo = (n: number) => {
    // Choosing a step is a request to look at it, not to be moved off it.
    setPlaying(false);
    setStep(n);
    setRunId((v) => v + 1);
  };

  const s = DEMO_STEPS[step];
  const graph = useMemo(() => demoGraphAt(step), [step]);
  const agent = useMemo(() => demoAgentAt(step), [step]);
  const output = useMemo(() => exportAgent(agent), [agent]);

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-pixel text-xs sm:text-sm mb-1">DEMO_MODE</h1>
            <PoweredBy />
          </div>
          <div className="flex flex-wrap gap-2">
            <PixelButton variant="ghost" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </PixelButton>
            <Link href={`/login${from ? `?next=${encodeURIComponent(from)}` : ""}`}>
              <PixelButton variant="coral">Sign in to build one →</PixelButton>
            </Link>
          </div>
        </div>

        {/* Why they are here rather than where they asked to be. Stating it
            plainly beats a redirect that looks like the link was broken. */}
        <Panel className="p-4 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone="coral">Simulation</Badge>
          <p className="font-mono text-xs text-ink-soft flex-1 min-w-[16rem] leading-relaxed">
            {from ? (
              <>
                <code className="text-coral-text">{from}</code> needs an account —
                it saves agents and spends AI drafts. This is the same flow, run
                on pre-loaded data.
              </>
            ) : (
              <>
                Everything below is pre-loaded and read-only. Nothing is drafted,
                nothing is stored, no model is called.
              </>
            )}
          </p>
        </Panel>

        {/* STEP RAIL */}
        <div className="grid gap-2 sm:grid-cols-5 mb-5">
          {DEMO_STEPS.map((st, i) => (
            <button
              key={st.key}
              onClick={() => goTo(i)}
              aria-current={i === step ? "step" : undefined}
              className={clsx(
                "text-left flex items-center gap-2 px-3 py-2 border-2 border-line transition-colors cursor-pointer",
                i === step ? "bg-fill text-on-fill" : "bg-paper hover:bg-stone",
              )}
            >
              <span
                className={clsx(
                  "w-4 h-4 grid place-items-center font-pixel text-[9px] border-2 border-line shrink-0",
                  i === step ? "bg-coral-text text-paper" : "bg-paper",
                )}
              >
                {i + 1}
              </span>
              <span className="font-mono text-xs truncate">{st.label}</span>
              {i === step && playing && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-coral t-pulse-dot" />
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5 min-w-0">
            {/* The real canvas, frozen. Panning, zooming and selecting all
                work — it is the composer's surface, just with the editing
                taken away rather than a picture of it. */}
            <AgentCanvas
              graph={graph}
              onChange={() => {}}
              selection={[]}
              onSelectionChange={() => {}}
              locked
              // No onLockedChange: the lock is not the viewer's to open, and
              // the canvas greys the toolbar button out when it sees that.
              refitOn={step}
              className="h-[420px]"
              toolbar={<Badge tone="coral">read-only</Badge>}
            />

            <Panel className="p-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-pixel text-[10px] uppercase">{s.title}</span>
                <Badge>{s.where}</Badge>
              </div>
              <p className="font-mono text-[11px] text-muted mb-4 leading-relaxed">{s.blurb}</p>

              {/* Keyed on the step so each panel remounts and replays its
                  entrance instead of cross-fading into the next one. */}
              <div key={`${step}-${runId}`}>
                {s.key === "brief" && <BriefPanel runId={runId} />}
                {s.key === "persona" && <PersonaPanel runId={runId} />}
                {s.key === "skills" && <SkillsPanel />}
                {s.key === "delegate" && <DelegatePanel />}
                {s.key === "export" && <ExportPanel />}
              </div>
            </Panel>
          </div>

          <div className="space-y-5 min-w-0 lg:sticky lg:top-20 self-start">
            <Panel className="p-5 text-center">
              <div className="grain mascot-stage relative pixel-border-sm p-5 overflow-hidden">
                <Mascot state={s.mascot} size={104} />
              </div>
              <div className="mt-3 font-sans font-bold truncate">{agent.name}</div>
              <div className="font-mono text-[11px] text-muted truncate">{agent.role}</div>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <Badge>{subagentsOf(graph).length} subagents</Badge>
                <Badge>{agent.skills.length} components</Badge>
              </div>
              <div className="flex items-center justify-center mt-2 font-mono text-[10px] text-muted">
                <span className="t-shimmer" data-text={MASCOTS[s.mascot].blurb}>
                  {MASCOTS[s.mascot].blurb}
                </span>
              </div>
            </Panel>

            {/* Grows as the graph does — the file is derived from the canvas,
                so watching it fill in is the honest way to show that. */}
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-line bg-stone">
                <span className="font-mono text-[11px]">{output.filename}</span>
                <Badge>live</Badge>
              </div>
              <ResizeBox max={360}>
                <pre className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
                  {output.content}
                </pre>
              </ResizeBox>
            </Panel>

            <Panel className="p-5 text-center">
              <div className="grain mascot-stage relative pixel-border-sm p-4 inline-block">
                <Mascot state="coffee" size={72} animate={false} />
              </div>
              <h2 className="font-sans font-bold text-base mt-3">Your turn</h2>
              <p className="font-mono text-[11px] text-muted mt-1.5 leading-relaxed">
                An account is free: 3 saved agents and 10 AI drafts a month, the
                whole registry, every export target.
              </p>
              <Link
                href={`/login${from ? `?next=${encodeURIComponent(from)}` : ""}`}
                className="block mt-4"
              >
                <PixelButton variant="coral" className="w-full">
                  Sign in with GitHub →
                </PixelButton>
              </Link>
              <Link href="/pricing" className="block mt-2">
                <PixelButton variant="ghost" className="w-full">
                  What each plan gives you
                </PixelButton>
              </Link>
            </Panel>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="p-10 font-mono text-sm">loading demo…</div>}>
      <Demo />
    </Suspense>
  );
}
