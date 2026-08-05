"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge, Field, TextInput, TextArea, Segmented } from "@/components/ui";
import {
  TARGETS,
  modelsFor,
  type Agent,
  type AgentTarget,
  type PickedSkill,
} from "@/lib/types";
import { saveAgent } from "@/lib/store";

const TONES = ["Direct", "Friendly", "Formal", "Playful"] as const;
type Tone = (typeof TONES)[number];

interface Drafted {
  name: string;
  role: string;
  systemPrompt: string;
  // Picked by the model out of live skills.sh results, so every repo here
  // resolves. Can legitimately be empty — the registry may have nothing that
  // fits, and padding the list would be worse than leaving it to the composer.
  // `null` means the second request is still in flight, which is a different
  // thing to show than "found nothing".
  skills: PickedSkill[] | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [purpose, setPurpose] = useState("");
  const [domain, setDomain] = useState("");
  const [tone, setTone] = useState<Tone>("Direct");
  const [target, setTarget] = useState<AgentTarget>("claude-code");
  const [teamName, setTeamName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<Drafted | null>(null);

  const draft = async () => {
    if (!purpose.trim()) {
      setError("Tell it what the agent should do first.");
      return;
    }
    setLoading(true);
    setError(null);
    setDrafted(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose, domain, tone, target, teamName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "draft failed");

      // Show the persona the moment it lands — the registry search and the
      // pick that follow take about as long again, and a blank panel for the
      // whole nine seconds read as a hang.
      setDrafted({ ...data, skills: null });
      setLoading(false);

      const picked = await fetch("/api/onboarding/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          searchTerms: data.searchTerms,
          brief: data.brief,
          name: data.name,
          role: data.role,
        }),
      });
      const skillData = await picked.json().catch(() => ({ skills: [] }));
      // The persona is already on screen and usable, so a failure here settles
      // to "no skills" rather than throwing the whole draft away.
      setDrafted((d) => (d ? { ...d, skills: skillData.skills ?? [] } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "draft failed");
      setLoading(false);
    }
  };

  const openInComposer = () => {
    if (!drafted) return;
    const agent: Agent = {
      id: `agent-${Date.now().toString(36)}`,
      name: drafted.name,
      role: drafted.role,
      systemPrompt: drafted.systemPrompt,
      target,
      model: modelsFor(target)[0].id,
      temperature: 0.7,
      skills: drafted.skills ?? [],
      // ^ still null if the user hits the button before the pick lands; the
      //   composer is where skills get edited anyway.
      mascot: "wizard",
      accent: "#f95c4b",
      createdAt: Date.now(),
    };
    saveAgent(agent);
    router.push(`/build?id=${agent.id}`);
  };

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-pixel text-sm mb-1">ONBOARDING</h1>
        <PoweredBy />
        <p className="mt-4 font-mono text-sm text-ink-soft">
          Answer a few questions — an Azure AI Foundry model drafts the persona,
          then searches skills.sh and picks the skills that fit it.
        </p>

        <Panel className="p-5 mt-6 space-y-4">
          <Field label="What should this agent do?">
            <TextArea
              rows={3}
              placeholder="e.g. review pull requests for a Django backend, flag N+1 queries and missing tests"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </Field>

          <Field label="Domain / stack" hint="optional">
            <TextInput
              placeholder="e.g. Next.js frontend, data pipeline, security"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </Field>

          <Field label="Tone">
            <Segmented<Tone>
              options={TONES.map((t) => ({ id: t, label: t }))}
              value={tone}
              onChange={setTone}
            />
          </Field>

          <Field label="Target tool" hint={TARGETS.find((t) => t.id === target)?.hint}>
            <Segmented<AgentTarget>
              options={TARGETS.map((t) => ({ id: t.id, label: t.label }))}
              value={target}
              onChange={setTarget}
            />
          </Field>

          <Field label="Team / project name" hint="optional">
            <TextInput
              placeholder="e.g. Acme checkout squad"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </Field>

          {error && (
            <p className="font-mono text-xs text-coral-deep border-2 border-coral-deep px-3 py-2">
              {error}
            </p>
          )}

          <PixelButton variant="coral" onClick={draft} disabled={loading} className="w-full">
            {loading ? "Drafting…" : "Draft with Foundry →"}
          </PixelButton>
        </Panel>

        {drafted && (
          <Panel className="p-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <Badge tone="coral">Draft</Badge>
              <button
                onClick={draft}
                disabled={loading}
                className="font-mono text-[11px] text-muted hover:text-ink underline"
              >
                regenerate
              </button>
            </div>
            <div className="flex gap-4 items-start">
              <div className="grain mascot-stage relative pixel-border-sm p-3 shrink-0">
                <Mascot state="wizard" size={64} />
              </div>
              <div className="min-w-0">
                <h2 className="font-sans font-bold text-lg">{drafted.name}</h2>
                <p className="font-mono text-xs text-muted mt-0.5">{drafted.role}</p>
                <p className="font-mono text-xs text-ink-soft mt-2 leading-relaxed whitespace-pre-wrap">
                  {drafted.systemPrompt}
                </p>
              </div>
            </div>

            {/* Shown even when empty: silently handing over an agent with no
                skills would read as a bug rather than a deliberate result. */}
            <div className="mt-4 pt-4 border-t-2 border-line">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-pixel text-[10px] uppercase">Skills picked</span>
                <span className="font-mono text-[10px] text-muted">
                  {drafted.skills === null
                    ? "searching skills.sh…"
                    : `${drafted.skills.length} from skills.sh`}
                </span>
              </div>
              {drafted.skills === null ? (
                <div className="flex flex-wrap gap-1.5">
                  {/* Placeholder chips rather than a spinner: the row keeps the
                      height it will have, so the panel doesn't jump when the
                      real picks arrive. */}
                  {[72, 96, 64].map((w) => (
                    <span
                      key={w}
                      style={{ width: w }}
                      className="h-[21px] border-2 border-line bg-stone-deep animate-pulse"
                    />
                  ))}
                </div>
              ) : drafted.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {drafted.skills.map((s) => (
                    <span
                      key={s.id}
                      title={s.repo}
                      className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border-2 border-line bg-fill text-on-fill"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-[11px] text-muted">
                  Nothing in the registry matched closely — pick some in the composer.
                </p>
              )}
            </div>

            <PixelButton variant="coral" onClick={openInComposer} className="mt-4 w-full">
              Use this — open in composer →
            </PixelButton>
          </Panel>
        )}
      </div>
      <Footer />
    </div>
  );
}
