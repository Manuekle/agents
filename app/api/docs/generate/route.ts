import { NextResponse } from "next/server";
import { FOUNDRY_ERROR, clientIp, foundryClient, rateLimit } from "@/lib/foundry";
import { clamp } from "@/lib/ai/brief";
import { requireAccount } from "@/lib/api-auth";
import { supabaseServer } from "@/lib/supabase/server";
import { planAllows, cheapestPlanWith } from "@/lib/access";
import { planOf } from "@/lib/plans";
import { docScaffold, withAiBody } from "@/lib/docs";
import { normalizeGraph } from "@/lib/graph";
import type { Agent, PickedSkill } from "@/lib/types";

// Fills one context-doc scaffold's TODOs with a model call — Pro and Max
// only. The scaffolds ship free for everyone (lib/docs.ts renders them with
// no API call at all); this route is what turns a `TODO` into an actual
// paragraph, and that costs a Foundry call per doc, so it rides the plan gate
// the drafts do.

export const runtime = "nodejs";

const MAX_SKILLS = 60;
const MAX_NODES = 80;
const NAME_MAX = 80;
const ROLE_MAX = 200;
const PROMPT_MAX = 2000;

const SYSTEM = `You fill in a documentation scaffold for the internal docs of a software
coding agent. You are given the scaffold's headings and, under each one, an
instruction in italics plus a TODO placeholder (and sometimes a skeleton
table). Replace every instruction line and TODO with real, useful, technical
content that fits the agent described — same headings, same order, markdown
only.

Rules:
- Output only the body: no frontmatter, no leading "# Title" line, no
  "## Related" section — those are added separately.
- Keep every "## " heading exactly as given, in the same order. Do not add or
  remove headings.
- Tables: keep the header row and column count; replace placeholder rows with
  real ones, adding rows where useful.
- Never invent specific unknowable facts — real hex colours, real endpoints,
  real credentials, real file paths you were not given. Where the agent's
  description does not settle something, write the most sensible convention
  for its stated stack and say so briefly, rather than a TODO.
- Be concrete and technical. No filler, no restating the instruction line.`;

function scaffoldInput(
  agent: Agent,
  meta: { title: string; area: string; body: string },
): string {
  const skills = agent.skills
    .slice(0, 12)
    .map((s) => s.name)
    .join(", ");
  return `Doc: ${meta.title} (${meta.area})

Agent name: ${agent.name}
Agent role: ${agent.role}
System prompt: ${agent.systemPrompt}
Target tool: ${agent.target}
Installed components: ${skills || "(none picked yet)"}

Scaffold to fill in:
---
${meta.body}
---`;
}

/** The client-sent agent, clamped to sane sizes before it reaches a model. */
function sanitizeAgent(raw: unknown): Agent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const name = clamp(r.name, NAME_MAX) || "Untitled Agent";
  const role = clamp(r.role, ROLE_MAX);
  const systemPrompt = clamp(r.systemPrompt, PROMPT_MAX);
  const target = typeof r.target === "string" ? r.target : "generic-mcp";

  const rawSkills = Array.isArray(r.skills) ? r.skills : [];
  const skills: PickedSkill[] = rawSkills.slice(0, MAX_SKILLS).flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const sk = s as Record<string, unknown>;
    const skillName = clamp(sk.name, NAME_MAX);
    if (!skillName) return [];
    return [
      {
        id: typeof sk.id === "string" ? sk.id : skillName,
        name: skillName,
        repo: typeof sk.repo === "string" ? sk.repo.slice(0, 200) : undefined,
        installArg: typeof sk.installArg === "string" ? sk.installArg.slice(0, 200) : undefined,
      },
    ];
  });

  const base: Agent = {
    id: typeof r.id === "string" ? r.id : "agent",
    name,
    role,
    systemPrompt,
    target: target as Agent["target"],
    model: typeof r.model === "string" ? r.model : "",
    temperature: typeof r.temperature === "number" ? r.temperature : 0.7,
    skills,
    mascot: "working",
    accent: "#f95c4b",
    createdAt: Date.now(),
  };

  // normalizeGraph already treats its input as untrusted — it is what
  // app/api/mcp/agent/route.ts runs a raw database column through — so it is
  // the right tool for a raw client payload too. Trimmed to MAX_NODES first:
  // that function does not cap size, and the pack is billed per doc, not per
  // node, so an oversized graph should not inflate the prompt.
  const rawGraph =
    r.graph && typeof r.graph === "object" && Array.isArray((r.graph as { nodes?: unknown }).nodes)
      ? { ...(r.graph as object), nodes: (r.graph as { nodes: unknown[] }).nodes.slice(0, MAX_NODES) }
      : r.graph;

  return { ...base, graph: normalizeGraph(rawGraph, base) };
}

export async function POST(req: Request) {
  const gate = await requireAccount("generate a context doc with AI");
  if (!gate.ok) return gate.response;

  // No accounts on this deploy at all means no plans to gate by — the plan
  // system does not exist here, so nothing about this feature can be "Pro
  // only". Everyone gets it, same as nothing else on the deploy is gated.
  if (gate.userId) {
    const supabase = await supabaseServer();
    const { data: profile } = supabase
      ? await supabase.from("profiles").select("plan").eq("id", gate.userId).maybeSingle()
      : { data: null };
    const plan = planOf(profile?.plan as string | undefined).id;

    if (!planAllows(plan, "ai-docs")) {
      const upsell = cheapestPlanWith("ai-docs");
      return NextResponse.json(
        {
          error: `AI-generated context docs need ${upsell.label} or above. See /pricing.`,
        },
        { status: 402 },
      );
    }
  }

  const foundry = foundryClient();
  if (!foundry) return NextResponse.json({ error: FOUNDRY_ERROR }, { status: 500 });

  const limit = rateLimit("docs", clientIp(req), 20);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests — wait ${limit.retryAfter}s and try again.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const path = typeof raw.path === "string" ? raw.path : "";
  const agent = sanitizeAgent(raw.agent);
  if (!agent) return NextResponse.json({ error: "agent is required" }, { status: 422 });

  const meta = docScaffold(agent, path);
  if (!meta) return NextResponse.json({ error: `unknown doc "${path}"` }, { status: 404 });

  let text: string;
  try {
    const response = await foundry.client.responses.create({
      model: foundry.model,
      instructions: SYSTEM,
      input: scaffoldInput(agent, meta),
      reasoning: { effort: "none" },
      max_output_tokens: 1400,
    });
    text = response.output_text ?? "";
  } catch {
    return NextResponse.json({ error: "the model call failed — try again" }, { status: 502 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "the model returned nothing — try again" }, { status: 502 });
  }

  const doc = withAiBody(agent, path, text);
  if (!doc) return NextResponse.json({ error: `unknown doc "${path}"` }, { status: 404 });

  return NextResponse.json({ doc }, { headers: { "cache-control": "private, no-store" } });
}
