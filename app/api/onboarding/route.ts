import { NextResponse } from "next/server";
import OpenAI from "openai";
import { TARGETS } from "@/lib/types";

// Server-side only — drafts a persona via an Azure AI Foundry model, reached
// through its OpenAI-compatible /openai/v1 endpoint (Responses API). The
// Foundry API key never reaches the browser: this route holds it in env vars
// and the client only ever talks to /api/onboarding.

export const runtime = "nodejs";

// ---- rate limit ----------------------------------------------------------
// This endpoint spends real money on every call, so it cannot be an open
// faucet. Fixed window per IP, held in process memory: Fluid Compute reuses
// instances across requests, so this reliably stops one client hammering the
// form. It is NOT a distributed guarantee — traffic spread across instances
// gets a proportionally higher ceiling. A durable store (KV/Redis) would be
// the upgrade if this ever sees real volume.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();

  // Drop expired entries before the map can grow without bound.
  if (hits.size > MAX_TRACKED_IPS) {
    for (const [key, v] of hits) if (now > v.resetAt) hits.delete(key);
  }

  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// ---- input ---------------------------------------------------------------
// Every field is capped before it reaches the model: the prompt is billed by
// the token, so an unbounded `purpose` is an unbounded bill.
const LIMITS = { purpose: 600, domain: 200, tone: 40, teamName: 120 } as const;

const TARGET_IDS = new Set(TARGETS.map((t) => t.id));

function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

interface DraftedAgent {
  name: string;
  role: string;
  systemPrompt: string;
}

const SYSTEM_PROMPT =
  "Draft a coding-agent persona from the user's brief. " +
  "name: 2-4 words, punchy. role: one lowercase clause, no leading article. " +
  "systemPrompt: 2-4 sentences, second person, concrete about scope and constraints, no filler.";

// Structured Outputs — the model is constrained to this shape, so the response
// is valid JSON on the first call. Without it a malformed reply costs a second
// round trip to recover from.
const SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    systemPrompt: { type: "string" },
  },
  required: ["name", "role", "systemPrompt"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const model = process.env.AZURE_FOUNDRY_DEPLOYMENT;

  if (!endpoint || !apiKey || !model) {
    return NextResponse.json(
      {
        error:
          "Foundry not configured — set AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY and AZURE_FOUNDRY_DEPLOYMENT",
      },
      { status: 500 },
    );
  }

  const limit = rateLimit(clientIp(req));
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

  const target = typeof raw.target === "string" && TARGET_IDS.has(raw.target as never)
    ? raw.target
    : "generic-mcp";

  const brief = [
    `Purpose: ${purpose}`,
    `Domain/stack: ${clamp(raw.domain, LIMITS.domain) || "general"}`,
    `Tone: ${clamp(raw.tone, LIMITS.tone) || "direct"}`,
    `Target tool: ${target}`,
    clamp(raw.teamName, LIMITS.teamName) && `Team/project: ${clamp(raw.teamName, LIMITS.teamName)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new OpenAI({ baseURL: endpoint, apiKey });

  let text: string;
  try {
    const response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: brief,
      // The task is formatting, not deduction — reasoning tokens here are pure
      // cost. Capped output because the drafted persona is ~150 tokens.
      // (gpt-5.4-mini rejects "minimal"; "none" is its floor.)
      reasoning: { effort: "none" },
      max_output_tokens: 500,
      text: {
        format: { type: "json_schema", name: "agent_persona", strict: true, schema: SCHEMA },
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

  return NextResponse.json(drafted);
}
