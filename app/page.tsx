"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HowItWorks } from "@/components/HowItWorks";
import { Mascot } from "@/components/Mascot";
import { DitherField } from "@/components/DitherField";
import { TiltCard } from "@/components/TiltCard";
import { Panel, PixelButton, Badge, Notice } from "@/components/ui";
import { HeartButton } from "@/components/Sponsor";
import { UsageChip } from "@/components/PlanUsage";
import { StarIcon, AngleDownSolidIcon, ArrowRightIcon } from "@/components/icons";
import { MASCOT_ORDER, MASCOTS } from "@/lib/mascot";
import { useAgents, useAgentsLoading, useStoreError, deleteAgent } from "@/lib/store";
import { TARGETS, type Agent } from "@/lib/types";
import { subagentsOf } from "@/lib/graph";
import { useStars } from "@/lib/stars";
import { PLAN_ORDER } from "@/lib/plans";
import { useSignedIn } from "@/lib/use-auth";
import { SITE, fmtCount } from "@/lib/site";
import { clsx } from "@/lib/clsx";

const FAQS = [
  { q: "Is it really free?", a: "Yes — the Free plan is $0: 3 saved agents, 10 AI drafts a month, the full skills.sh registry and every export target. Pro adds 25 agents, 200 drafts, your own API key and MCP serving for $12." },
  { q: "Do I need an account?", a: "To build one, yes — the composer saves agents and the drafts run on our model, so both need an account to attribute them to. Without one you get /demo: the whole flow, start to finish, on pre-loaded data." },
  { q: "What does signing in give me?", a: "The composer, the AI drafts and MCP tokens. Agents save to your account (GitHub OAuth, via Supabase) and follow you across devices — including anything you composed here before accounts existed." },
  { q: "How does sharing work?", a: "A shared agent travels in the URL — no database row. The recipient opens the exact same build and saves their own copy." },
  { q: "How do I install a skill?", a: "Export gives you install commands per component. The skills CLI auto-detects Claude Code, Cursor and Codex and writes into their skills directory." },
  { q: "Can any model use my agent?", a: "Yes — serve it over MCP. One command exposes the agent's persona and skills to any MCP-capable model." },
  { q: "What if my prompt is too long to share?", a: "Share links have a size cap. Export agent.json and drop it in the repo instead — same build, no limit." },
];

/** Specialists under an agent's orchestrator. Pre-canvas rows have none. */
function subagentCount(a: Agent): number {
  return a.graph ? subagentsOf(a.graph).length : 0;
}

export default function Home() {
  const agents = useAgents();
  const agentsLoading = useAgentsLoading();
  const storeError = useStoreError();
  // Which agent's ✕ has been armed. One at a time, and cleared on blur.
  const [confirming, setConfirming] = useState<string | null>(null);
  const stars = useStars();
  // `null` until auth resolves. The hero treats unknown as signed-in so the
  // primary button does not flip from "Forge" to "Watch" under the pointer on
  // every load for people who are in fact signed in.
  const signedIn = useSignedIn();
  const guest = signedIn === false;
  // which FAQ item is open; null = all closed
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [i, setI] = useState(0);
  // Held off one frame so the lines have a "before" to transition from —
  // applying .is-shown in the same paint would skip the reveal.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // cycle the hero mascot through every state
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MASCOT_ORDER.length), 1800);
    return () => clearInterval(t);
  }, []);
  const state = MASCOT_ORDER[i];

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b-2 border-line">
        <DitherField className="absolute inset-0 w-full h-full opacity-90" cell={7} />
        {/* keep the headline legible over the dark dither lobes */}
        <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/75 to-transparent md:to-paper/0 pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 grid gap-10 md:grid-cols-[1.1fr_0.9fr] items-center">
          <div className={clsx("t-stagger", shown && "is-shown")}>
            <div className="mb-4 t-stagger-line t-stagger-line--1">
              <Badge tone="coral">v0.1 · pixel native</Badge>
            </div>
            <h1 className="font-serif text-5xl md:text-6xl leading-[0.98] tracking-tight t-stagger-line t-stagger-line--2">
              Build AI agents.
              <br />
              <span className="caret">Ship your skills</span>
            </h1>
            <p className="mt-5 max-w-md font-mono text-sm text-ink-soft bg-paper/80 inline-block px-2 py-1 t-stagger-line t-stagger-line--3">
              Scrape skills, compose agents, export to Claude Code, Codex &amp; any
              MCP model. All pixel, all custom.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 t-stagger-line t-stagger-line--4">
              {guest ? (
                <>
                  <Link href="/demo">
                    <PixelButton variant="coral">
                      <span className="inline-flex items-center gap-1.5">
                        Watch it get built
                        <ArrowRightIcon size={12} />
                      </span>
                    </PixelButton>
                  </Link>
                  <Link href="/login?next=%2Fnew">
                    <PixelButton variant="ghost">Sign in to build</PixelButton>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/new">
                    <PixelButton variant="coral">
                      <span className="inline-flex items-center gap-1.5">
                        Forge an agent
                        <ArrowRightIcon size={12} />
                      </span>
                    </PixelButton>
                  </Link>
                  <Link href="/demo">
                    <PixelButton variant="ghost">See the demo</PixelButton>
                  </Link>
                </>
              )}
              <Link href="/skills">
                <PixelButton variant="ghost">Browse skills</PixelButton>
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted t-stagger-line t-stagger-line--5">
              <span className="inline-flex items-center gap-1">
                <StarIcon size={10} className="text-coral" />
                {stars === null ? "—" : `${fmtCount(stars)} on GitHub`}
              </span>
              <span>·</span>
              <span>{TARGETS.length} export targets</span>
              <span>·</span>
              <span>{PLAN_ORDER.length} plans, free to start</span>
            </div>
          </div>

          {/* mascot state showcase */}
          <div className="justify-self-center">
            <Panel className="p-6 bg-paper w-64 text-center">
              <div className="grain mascot-stage relative pixel-border-sm p-6 mb-4 overflow-hidden">
                <Mascot state={state} size={120} />
              </div>
              <div className="font-pixel text-xs">{MASCOTS[state].label}</div>
              <div className="font-mono text-[11px] text-muted mt-1">
                {MASCOTS[state].blurb}
              </div>
              <div className="mt-3 flex justify-center gap-1 flex-wrap">
                {MASCOT_ORDER.map((s, n) => (
                  <button
                    key={s}
                    onClick={() => setI(n)}
                    aria-label={s}
                    className={`w-2 h-2 border border-line ${n === i ? "bg-coral" : "bg-paper"}`}
                  />
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-5 py-14 grid gap-4 md:grid-cols-3">
        {[
          { t: "Skill scraping", d: "Pull skills from any registry, README or JSON feed into one catalog.", tag: "scrape" },
          { t: "Guided or manual", d: "Let AI draft the persona from a few answers, or write every field yourself.", tag: "compose" },
          { t: "Multi-target export", d: "Claude Code, Codex, Cursor, Gemini CLI or raw MCP config.", tag: "export" },
        ].map((f, idx) => (
          <TiltCard key={f.t}>
            <Panel className="p-5 pop-in">
              <div style={{ animationDelay: `${idx * 60}ms` }}>
                <Badge>{f.tag}</Badge>
                <h3 className="font-sans font-bold text-lg mt-3">{f.t}</h3>
                <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed">{f.d}</p>
              </div>
            </Panel>
          </TiltCard>
        ))}
      </section>

      {/* EXPORT TARGETS — one agent, every tool */}
      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm">EXPORT_TARGETS</h2>
          <span className="font-mono text-[11px] text-muted">one agent, five tools</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TARGETS.map((t) => (
            <Panel key={t.id} className="p-3">
              <div className="font-sans font-bold text-sm">{t.label}</div>
              <div className="font-mono text-[10px] text-muted mt-1 leading-snug">{t.hint}</div>
            </Panel>
          ))}
        </div>
      </section>

      {/* SERVE OVER MCP — one command, any MCP model */}
      <section className="mx-auto max-w-6xl px-5 pb-14">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b-2 border-line bg-coral-text text-paper">
            <span className="font-pixel text-[10px] uppercase">Serve over MCP</span>
            <Link href="/mcp" className="font-mono text-[10px] underline">
              <span className="inline-flex items-center gap-1">
                set it up
                <ArrowRightIcon size={10} />
              </span>
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4">
            <p className="font-mono text-xs text-ink leading-relaxed max-w-xl">
              Run one command and any MCP-capable model — Claude, GPT, Gemini — can call your
              agent's skills straight from the prompt.
            </p>
            <code className="w-full sm:w-auto min-w-0 overflow-x-auto whitespace-nowrap bg-stone border-2 border-line px-2 py-1.5 font-mono text-[10px]">
              npx -y @manudev.jsx/creagent --agent ./creagent.agent.json
            </code>
          </div>
        </Panel>
      </section>

      {/* WHO IT IS FOR — three ways in */}
      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm">WHO_IT_IS_FOR</h2>
          <span className="font-mono text-[11px] text-muted">three ways in</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Panel className="p-4">
            <Badge>solo</Badge>
            <h3 className="font-sans font-bold text-sm mt-3">One repo, one persona</h3>
            <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed">
              Compose once, drop CLAUDE.md in, and keep every picked skill in sync with one
              manifest.
            </p>
          </Panel>
          <Panel className="p-4">
            <Badge>team</Badge>
            <h3 className="font-sans font-bold text-sm mt-3">Share by link</h3>
            <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed">
              Send a share link — the recipient opens the exact same build and can fork it or
              export it to their own tool.
            </p>
          </Panel>
          <Panel className="p-4">
            <Badge>product</Badge>
            <h3 className="font-sans font-bold text-sm mt-3">Ship agents as config</h3>
            <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed">
              Export agent.json, serve it over MCP, and any model in your product can call the
              persona.
            </p>
          </Panel>
        </div>
      </section>

      {/* AGENT_JSON — one file, every tool */}
      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm">AGENT_JSON</h2>
          <span className="font-mono text-[11px] text-muted">one file, every tool</span>
        </div>
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b-2 border-line bg-stone">
            <span className="font-mono text-[11px]">creagent.agent.json</span>
            <span className="font-mono text-[10px] text-muted">what ships</span>
          </div>
          <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-auto">{`{
  "version": 2,
  "name": "Untitled Agent",
  "role": "general assistant",
  "model": "claude-opus-5",
  "temperature": 0.7,
  "system": "You are a focused, pixel-precise engineering agent.",
  "skills": [
    {
      "name": "QA",
      "kind": "skills",
      "repo": "mattpocock/skills"
    }
  ],
  "orchestrator": null,
  "subagents": []
}`}</pre>
        </Panel>
      </section>

      {/* HOW IT WORKS — animated live demo of the real flow */}
      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm">HOW_IT_WORKS</h2>
          <span className="font-mono text-[11px] text-muted">compose → skills → install → serve</span>
        </div>
        <HowItWorks />
      </section>

      {/* SAVED AGENTS */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-pixel text-sm">YOUR_AGENTS</h2>
          <div className="flex items-center gap-2">
            {/* Answers "how many of these am I allowed" without leaving the
                page. Renders nothing signed out. */}
            <UsageChip kind="agents" />
            <Link href={guest ? "/login?next=%2Fnew" : "/new"}>
              <PixelButton>{guest ? "Sign in" : "+ New"}</PixelButton>
            </Link>
          </div>
        </div>

        {/* Where a failed write actually surfaces. The one that matters here is
            the first-sign-in migration: agents composed on this browser before
            the account existed are upserted into it, and if that is refused
            they stay local and invisible in the list below. */}
        {storeError && <Notice className="mb-4">{storeError}</Notice>}

        {guest ? (
          // Not "no agents yet" — a signed-out visitor has no agents *here*
          // because agents belong to accounts, and saying "the forge is cold"
          // would imply they had lost some.
          <Panel className="p-10 text-center dither-stone">
            <Mascot state="coffee" size={72} className="mx-auto" />
            <p className="font-mono text-sm mt-3">
              Agents live in an account. Sign in and this fills up.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/login?next=%2Fnew">
                <PixelButton variant="coral">
                  <span className="inline-flex items-center gap-1.5">
                    Sign in with GitHub
                    <ArrowRightIcon size={12} />
                  </span>
                </PixelButton>
              </Link>
              <Link href="/demo">
                <PixelButton variant="ghost">See one get built first</PixelButton>
              </Link>
            </div>
          </Panel>
        ) : agentsLoading ? (
          // Signing in fetches the account's agents; showing "the forge is
          // cold" in the meantime tells a signed-in user their work is gone.
          <Panel className="p-10 text-center dither-stone">
            <Mascot state="coffee" size={72} className="mx-auto" />
            <p className="font-mono text-sm mt-3">Loading your agents…</p>
          </Panel>
        ) : agents.length === 0 ? (
          <Panel className="p-10 text-center dither-stone">
            <Mascot state="sleeping" size={72} className="mx-auto" />
            <p className="font-mono text-sm mt-3">No agents yet — the forge is cold.</p>
            <Link href="/new" className="inline-block mt-4">
              <PixelButton variant="coral">
                <span className="inline-flex items-center gap-1.5">
                  Forge your first
                  <ArrowRightIcon size={12} />
                </span>
              </PixelButton>
            </Link>
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* min-w-0 on the card: grid items default to min-width:auto, so a
                long agent role sizes the track to its own max-content and the
                card overflows the viewport instead of truncating. */}
            {agents.map((a) => (
              <Panel key={a.id} className="p-4 min-w-0">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mascot-stage relative overflow-hidden pixel-border-sm p-1.5 shrink-0">
                    <Mascot state={a.mascot} size={48} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-sans font-bold truncate">{a.name}</div>
                    <div className="font-mono text-[11px] text-muted truncate">{a.role}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge tone="coral">
                    {TARGETS.find((t) => t.id === a.target)?.label ?? a.target}
                  </Badge>
                  <Badge>
                    {a.skills.length} skill{a.skills.length === 1 ? "" : "s"}
                  </Badge>
                  {/* Only when there are any: "0 subagents" on every card is a
                      column of noise, and most agents are a single persona. */}
                  {subagentCount(a) > 0 && (
                    <Badge>
                      {subagentCount(a)} subagent{subagentCount(a) === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Link href={`/build?id=${a.id}`} className="flex-1">
                    <PixelButton className="w-full">Edit</PixelButton>
                  </Link>
                  {/* Two presses, not a browser confirm(): deleting an agent
                      cannot be undone — the row goes from the account — and a
                      single ✕ next to Edit is one slip away from losing it. */}
                  <PixelButton
                    variant="ghost"
                    aria-label={
                      confirming === a.id ? `Confirm deleting ${a.name}` : `Delete ${a.name}`
                    }
                    title={confirming === a.id ? "Press again to delete" : "Delete this agent"}
                    className={confirming === a.id ? "!bg-coral-text !text-paper" : undefined}
                    onClick={() => {
                      if (confirming === a.id) {
                        deleteAgent(a.id);
                        setConfirming(null);
                        return;
                      }
                      setConfirming(a.id);
                    }}
                    onBlur={() => setConfirming((id) => (id === a.id ? null : id))}
                  >
                    {confirming === a.id ? "Sure?" : "✕"}
                  </PixelButton>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>

      {/* FAQ — six straight answers */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm">FAQ</h2>
          <span className="font-mono text-[11px] text-muted">
            {FAQS.length} straight answers
          </span>
        </div>
        <div className="space-y-2">
          {FAQS.map((f, n) => (
            <div key={f.q} className="t-acc border-2 border-line bg-paper" data-open={openFaq === n}>
              <button
                type="button"
                className="t-acc-head w-full flex items-center justify-between gap-3 font-mono text-xs px-3 py-2 cursor-pointer hover:bg-stone transition-colors text-left"
                aria-expanded={openFaq === n}
                aria-controls={`faq-panel-${n}`}
                onClick={() => setOpenFaq(openFaq === n ? null : n)}
              >
                {f.q}
                <span className="t-acc-chevron shrink-0">
                  <AngleDownSolidIcon size={10} />
                </span>
              </button>
              <div className="t-acc-panel" id={`faq-panel-${n}`}>
                <div className="t-acc-panel-inner">
                  <p className="font-mono text-[10px] text-muted px-3 pb-2 leading-relaxed">
                    {f.a}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SUPPORT — sponsor the project */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm">SUPPORT</h2>
          <span className="font-mono text-[11px] text-muted">free, and staying that way</span>
        </div>
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b-2 border-line bg-coral-text text-paper">
            <span className="font-pixel text-[10px] uppercase">Sponsor the project</span>
            <a
              href={SITE.sponsorUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[10px] underline"
            >
              github sponsors ↗
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4">
            <p className="font-mono text-xs text-ink leading-relaxed max-w-xl">
              {SITE.name} is open source and built by one person. Sponsoring pays for the
              skills crawler and the drafting model — the two things that cost money — and
              keeps the Free plan free.
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a href={SITE.sponsorUrl} target="_blank" rel="noreferrer noopener">
                <PixelButton variant="coral">
                  <span className="inline-flex items-center gap-1.5">
                    Sponsor
                    <ArrowRightIcon size={12} />
                  </span>
                </PixelButton>
              </a>
              <HeartButton />
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
