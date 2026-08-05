import { NextResponse } from "next/server";
import { TARGETS } from "@/lib/types";
import { FOUNDRY_ERROR, LIMITS, clamp, clientIp, foundryClient, rateLimit } from "@/lib/foundry";

// Drafts the agent persona and nothing else. Skill picking lives in
// ./skills/route.ts so the browser can render the persona at ~4s instead of
// holding a blank panel for the ~9s the whole pipeline takes.
//
// The Foundry API key never reaches the browser: this route holds it in env
// vars and the client only ever talks to /api/onboarding.

export const runtime = "nodejs";

const TARGET_IDS = new Set(TARGETS.map((t) => t.id));

interface DraftedAgent {
  name: string;
  role: string;
  systemPrompt: string;
  searchTerms: string[];
}

const DRAFT_PROMPT =
  "Draft a coding-agent persona from the user's brief. " +
  "name: 2-4 words, punchy. role: one lowercase clause, no leading article. " +
  "systemPrompt: 2-4 sentences, second person, concrete about scope and constraints, no filler. " +
  "searchTerms: 2-4 short queries (1-2 words each) for an agent-skill registry — " +
  "the technologies and practices this agent needs, e.g. \"react\", \"testing\", \"security\". " +
  "Do not name specific skills or repositories; these are search queries, not results.";

// Structured Outputs — the model is constrained to this shape, so the response
// is valid JSON on the first call. Without it a malformed reply costs a second
// round trip to recover from.
const DRAFT_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    systemPrompt: { type: "string" },
    searchTerms: { type: "array", items: { type: "string" } },
  },
  required: ["name", "role", "systemPrompt", "searchTerms"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const foundry = foundryClient();
  if (!foundry) return NextResponse.json({ error: FOUNDRY_ERROR }, { status: 500 });

  const limit = rateLimit("draft", clientIp(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many drafts — wait ${limit.retryAfter}s and try again.` },
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
  const purpose = clamp(raw.purpose, LIMITS.purpose);
  if (!purpose) {
    return NextResponse.json({ error: "purpose is required" }, { status: 400 });
  }

  const target =
    typeof raw.target === "string" && TARGET_IDS.has(raw.target as never)
      ? raw.target
      : "generic-mcp";
  const teamName = clamp(raw.teamName, LIMITS.teamName);

  const brief = [
    `Purpose: ${purpose}`,
    `Domain/stack: ${clamp(raw.domain, LIMITS.domain) || "general"}`,
    `Tone: ${clamp(raw.tone, LIMITS.tone) || "direct"}`,
    `Target tool: ${target}`,
    teamName && `Team/project: ${teamName}`,
  ]
    .filter(Boolean)
    .join("\n");

  let text: string;
  try {
    const response = await foundry.client.responses.create({
      model: foundry.model,
      instructions: DRAFT_PROMPT,
      input: brief,
      // The task is formatting, not deduction — reasoning tokens here are pure
      // cost. Capped output because the drafted persona is ~150 tokens.
      // (gpt-5.4-mini rejects "minimal"; "none" is its floor.)
      reasoning: { effort: "none" },
      max_output_tokens: 600,
      text: {
        format: { type: "json_schema", name: "agent_persona", strict: true, schema: DRAFT_SCHEMA },
      },
    });
    text = response.output_text ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: `Foundry request failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 },
    );
  }

  let drafted: DraftedAgent;
  try {
    drafted = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Foundry returned malformed JSON" }, { status: 502 });
  }

  if (!drafted.name || !drafted.role || !drafted.systemPrompt) {
    return NextResponse.json({ error: "Foundry response missing required fields" }, { status: 502 });
  }

  // `brief` goes back out so the follow-up skill call can reuse it without the
  // client having to reassemble it — and without this route having to hold
  // state between two requests.
  return NextResponse.json({
    name: drafted.name,
    role: drafted.role,
    systemPrompt: drafted.systemPrompt,
    searchTerms: Array.isArray(drafted.searchTerms) ? drafted.searchTerms.slice(0, 4) : [],
    brief,
  });
}
