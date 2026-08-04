"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { HowItWorks } from "@/components/HowItWorks";
import { Mascot } from "@/components/Mascot";
import { DitherField } from "@/components/DitherField";
import { TiltCard } from "@/components/TiltCard";
import { Panel, PixelButton, Badge } from "@/components/ui";
import { MASCOT_ORDER, MASCOTS } from "@/lib/mascot";
import { useAgents, deleteAgent } from "@/lib/store";
import { TARGETS } from "@/lib/types";
import { clsx } from "@/lib/clsx";

export default function Home() {
  const agents = useAgents();
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
      <Nav />

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
              <Link href="/new">
                <PixelButton variant="coral">Forge an agent →</PixelButton>
              </Link>
              <Link href="/skills">
                <PixelButton variant="ghost">Browse skills</PixelButton>
              </Link>
            </div>
            <div className="mt-6">
              <PoweredBy />
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
          { t: "Agent composer", d: "Prompt, model, temperature, mascot & skills — one editable spec.", tag: "compose" },
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm">YOUR_AGENTS</h2>
          <Link href="/new">
            <PixelButton>+ New</PixelButton>
          </Link>
        </div>

        {agents.length === 0 ? (
          <Panel className="p-10 text-center dither-stone">
            <Mascot state="sleeping" size={72} className="mx-auto" />
            <p className="font-mono text-sm mt-3">No agents yet — the forge is cold.</p>
            <Link href="/new" className="inline-block mt-4">
              <PixelButton variant="coral">Forge your first →</PixelButton>
            </Link>
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <Panel key={a.id} className="p-4">
                <div className="flex items-start gap-3">
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
                </div>
                <div className="flex gap-2 mt-4">
                  <Link href={`/build?id=${a.id}`} className="flex-1">
                    <PixelButton className="w-full">Edit</PixelButton>
                  </Link>
                  <PixelButton variant="ghost" onClick={() => deleteAgent(a.id)}>
                    ✕
                  </PixelButton>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
