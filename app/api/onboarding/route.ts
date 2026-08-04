import { NextResponse } from "next/server";
import OpenAI from "openai";

// Server-side only — drafts a persona via an Azure AI Foundry model, reached
// through its OpenAI-compatible /openai/v1 endpoint (Responses API). The
// Foundry API key never reaches the browser: this route holds it in env vars
// and the client only ever talks to /api/onboarding.

interface OnboardingInput {
  purpose: string;
  domain?: string;
  tone?: string;
  target: string;
  teamName?: string;
}

interface DraftedAgent {
  name: string;
  role: string;
  systemPrompt: string;
}

const SYSTEM_PROMPT =
  "You draft coding-agent personas. Respond with strict JSON only, no prose, no code fences: " +
  '{"name": string, "role": string, "systemPrompt": string}. ' +
  "name: 2-4 words, punchy. role: one lowercase clause, no leading article. " +
  "systemPrompt: 2-4 sentences, second person, concrete about scope and constraints, no filler.";

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

  let input: OnboardingInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!input.purpose?.trim()) {
    return NextResponse.json({ error: "purpose is required" }, { status: 400 });
  }

  const client = new OpenAI({ baseURL: endpoint, apiKey });

  const brief = [
    `Purpose: ${input.purpose}`,
    `Domain/stack: ${input.domain || "general"}`,
    `Tone: ${input.tone || "direct"}`,
    `Target tool: ${input.target}`,
    input.teamName ? `Team/project: ${input.teamName}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string;
  try {
    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: brief },
      ],
    });
    raw = response.output_text ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: `Foundry request failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 },
    );
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return NextResponse.json({ error: "Foundry returned no parseable JSON" }, { status: 502 });
  }

  let drafted: DraftedAgent;
  try {
    drafted = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "Foundry returned malformed JSON" }, { status: 502 });
  }

  if (!drafted.name || !drafted.role || !drafted.systemPrompt) {
    return NextResponse.json({ error: "Foundry response missing required fields" }, { status: 502 });
  }

  return NextResponse.json(drafted);
}
