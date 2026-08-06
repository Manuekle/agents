"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { Mascot } from "@/components/Mascot";
import {
  Panel,
  PixelButton,
  Badge,
  Field,
  TextInput,
  TextArea,
  Segmented,
  Notice,
} from "@/components/ui";
import {
  TARGETS,
  modelsFor,
  type Agent,
  type AgentTarget,
  type PickedSkill,
} from "@/lib/types";
import { saveAgent, useAgents } from "@/lib/store";
import { refreshPlan, usePlan } from "@/lib/use-plan";
import { PLANS, atLimit, formatUsage } from "@/lib/plans";
import { graphFromAgent } from "@/lib/graph";
import { componentId } from "@/lib/aitmpl";
import { ArrowRightIcon } from "@/components/icons";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { aiConfig, settingsProblem, useAiSettings } from "@/lib/ai/settings";
import { draftPersona, pickSkills } from "@/lib/ai/draft";
import { providerOf } from "@/lib/ai/providers";

const TONES = ["Direct", "Friendly", "Formal", "Playful"] as const;
type Tone = (typeof TONES)[number];

interface Drafted {
  name: string;
  role: string;
  systemPrompt: string;
  // The model's own registry queries and the brief it was drafted from, both
  // carried forward so the skill-picking call can reuse them without either
  // side reassembling state.
  searchTerms: string[];
  brief: string;
  // Picked by the model out of live skills.sh results, so every repo here
  // resolves. Can legitimately be empty — the registry may have nothing that
  // fits, and padding the list would be worse than leaving it to the composer.
  // `null` means the second request is still in flight, which is a different
  // thing to show than "found nothing".
  skills: PickedSkill[] | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const settings = useAiSettings();
  const [purpose, setPurpose] = useState("");
  const [domain, setDomain] = useState("");
  const [tone, setTone] = useState<Tone>("Direct");
  const [target, setTarget] = useState<AgentTarget>("claude-code");
  const [teamName, setTeamName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<Drafted | null>(null);

  // Only the hosted path spends quota — a bring-your-own-key draft runs
  // against the visitor's own provider and never touches our bill, so metering
  // it would be charging for something we did not pay for.
  const { plan: planId, draftsUsed } = usePlan();
  const agents = useAgents();
  const plan = planId ? PLANS[planId] : null;
  const hosted = settings.mode !== "byok";
  const outOfDrafts = hosted && !!plan && atLimit(draftsUsed ?? 0, plan.drafts);
  // The composer saves the drafted agent on the way in, so the agent cap is
  // this page's problem too — and finding out after nine seconds of drafting
  // is the worst possible moment to learn about it.
  const outOfAgents = !!plan && atLimit(agents.length, plan.agents);

  // Both paths run the same two prompts in the same order; they differ only in
  // whose model answers them. Hosted goes through our routes so the Foundry key
  // stays server-side; bring-your-own-key calls the provider from here, because
  // that is the only way the key stays on this machine — and the only way a
  // localhost Ollama is reachable at all.
  const draftHosted = async (): Promise<Drafted> => {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ purpose, domain, tone, target, teamName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "draft failed");
    return { ...data, skills: null };
  };

  const pickHosted = async (d: Drafted) => {
    const picked = await fetch("/api/onboarding/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        searchTerms: d.searchTerms,
        brief: d.brief,
        name: d.name,
        role: d.role,
      }),
    });
    const skillData = await picked.json().catch(() => ({ skills: [] }));
    return (skillData.skills ?? []) as PickedSkill[];
  };

  const draft = async () => {
    if (!purpose.trim()) {
      setError("Tell it what the agent should do first.");
      return;
    }
    const problem = settingsProblem(settings);
    if (problem) {
      setError(problem);
      return;
    }
    if (outOfDrafts) {
      setError(
        "You're out of AI drafts for this month. Bring your own API key above, or see /pricing.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setDrafted(null);

    const byok = settings.mode === "byok";
    const config = aiConfig(settings);

    try {
      const persona: Drafted = byok
        ? { ...(await draftPersona(config, { purpose, domain, tone, target, teamName })), skills: null }
        : await draftHosted();

      // Show the persona the moment it lands — the registry search and the
      // pick that follow take about as long again, and a blank panel for the
      // whole nine seconds read as a hang.
      setDrafted({ ...persona, skills: null });
      setLoading(false);
      // The hosted call has just spent a draft server-side. Re-read so the
      // counter below moves now rather than on the next page load.
      if (!byok) refreshPlan();

      try {
        const skills = byok ? await pickSkills(config, persona) : await pickHosted(persona);
        setDrafted((d) => (d ? { ...d, skills } : d));
      } catch {
        // The persona is already on screen and usable, so a failure here
        // settles to "no skills" rather than throwing the whole draft away.
        setDrafted((d) => (d ? { ...d, skills: [] } : d));
      }
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
    // A drafted agent is a flat pick list; graphFromAgent lays it out under an
    // orchestrator so the composer opens on a canvas rather than on an agent
    // it has to migrate at first render.
    saveAgent({ ...agent, graph: graphFromAgent(agent) });
    router.push(`/build?id=${agent.id}`);
  };

  return (
    <div>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-pixel text-sm mb-1">ONBOARDING</h1>        <p className="mt-4 font-mono text-sm text-ink-soft">
          Answer a few questions — a model drafts the persona, then searches skills.sh
          and picks the skills that fit it. Run it on ours, or on your own API key:
          Claude, ChatGPT, Kimi, Gemini, or a local model through Ollama.
        </p>

        <div className="mt-6">
          <AiProviderSettings />
        </div>

        <Panel className="p-5 mt-5 space-y-4">
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

          <Field group label="Tone">
            <Segmented<Tone>
              options={TONES.map((t) => ({ id: t, label: t }))}
              value={tone}
              onChange={setTone}
            />
          </Field>

          <Field group label="Target tool" hint={TARGETS.find((t) => t.id === target)?.hint}>
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

          {error && <Notice>{error}</Notice>}

          {/* What a press costs, next to the button that spends it. Hidden on
              the bring-your-own-key path, which spends nothing of ours. */}
          {hosted && plan && (
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
              <span className={outOfDrafts ? "text-coral-deep" : "text-muted"}>
                <span className="tabular-nums">
                  {formatUsage(draftsUsed ?? 0, plan.drafts)}
                </span>{" "}
                AI drafts used this month on {plan.label}
              </span>
              {outOfDrafts && (
                <Link href="/pricing" className="text-coral-text underline">
                  <span className="inline-flex items-center gap-1">
                    see plans
                    <ArrowRightIcon size={11} />
                  </span>
                </Link>
              )}
            </div>
          )}

          <PixelButton
            variant="coral"
            onClick={draft}
            disabled={loading || outOfDrafts}
            title={outOfDrafts ? "No AI drafts left this month" : undefined}
            className="w-full"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                {/* theme pinned, not `auto`: the orb sits on the coral button,
                    which carries light text in both themes, so letting it
                    resolve from data-theme would paint dark ink on coral. */}
                <ThinkingOrb state="composing" size={20} theme="dark" aria-label="" />
                Drafting…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {`Draft with ${settings.mode === "byok" ? (providerOf(settings.provider)?.label ?? "your model") : "Foundry"}`}
                <ArrowRightIcon size={12} />
              </span>
            )}
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
              {/* items-center, not items-baseline: the orb is a canvas with no
                  text baseline to align to, so it would hang below the label. */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-pixel text-[10px] uppercase">Skills picked</span>
                <span className="font-mono text-[10px] text-muted inline-flex items-center gap-1.5">
                  {drafted.skills === null ? (
                    <>
                      {/* `auto` here — this sits on the panel, so it should
                          follow the theme toggle like everything else. */}
                      <ThinkingOrb state="searching" size={20} aria-label="" />
                      searching skills.sh…
                    </>
                  ) : (
                    `${drafted.skills.length} from skills.sh`
                  )}
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
                      className="h-[21px] border-2 border-line bg-stone-deep t-pulse-dot"
                    />
                  ))}
                </div>
              ) : drafted.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {drafted.skills.map((s) => (
                    <span
                      key={s.id}
                      title={s.repo ?? componentId(s.installArg)}
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

            {/* The composer saves on entry, so a full account has to be said
                here — the draft itself is fine, it just has nowhere to land. */}
            {outOfAgents && plan && (
              <Notice className="mt-4">
                {formatUsage(agents.length, plan.agents)} saved agents on{" "}
                {plan.label} — delete one from the home page to make room, or{" "}
                <Link href="/pricing" className="underline">
                  see plans
                </Link>
                .
              </Notice>
            )}
            <PixelButton
              variant="coral"
              onClick={openInComposer}
              disabled={outOfAgents}
              className="mt-4 w-full"
            >
              <span className="inline-flex items-center gap-1.5">
                Use this — open in composer
                <ArrowRightIcon size={12} />
              </span>
            </PixelButton>
          </Panel>
        )}
      </div>
    </div>
  );
}
