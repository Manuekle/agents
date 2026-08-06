import { NextResponse } from "next/server";
import { TARGETS } from "@/lib/types";
import { FOUNDRY_ERROR, LIMITS, clamp, clientIp, foundryClient, rateLimit } from "@/lib/foundry";
import { buildBrief } from "@/lib/ai/brief";
import { DRAFT_PROMPT, DRAFT_SCHEMA, type DraftedAgent } from "@/lib/ai/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/api-auth";

// Drafts the agent persona and nothing else. Skill picking lives in
// ./skills/route.ts so the browser can render the persona at ~4s instead of
// holding a blank panel for the ~9s the whole pipeline takes.
//
// This is the hosted path — our Foundry deployment, our bill, and so the plan
// quota below. A visitor who brought their own API key never reaches this
// route: their browser runs the same prompt against their own provider (see
// lib/ai/draft.ts), which is why nothing here has to know about the others.
//
// The Foundry API key never reaches the browser: this route holds it in env
// vars and the client only ever talks to /api/onboarding.

export const runtime = "nodejs";

const TARGET_IDS = new Set(TARGETS.map((t) => t.id));

export async function POST(req: Request) {
  // An account first, before anything is spent. This used to be optional, and
  // the monthly quota below could be walked around simply by signing out:
  // there was no identity to attribute a month to, so a signed-out draft only
  // ever met the per-IP ceiling. Requiring the account is what closes that.
  const gate = await requireAccount("draft an agent");
  if (!gate.ok) return gate.response;

  const foundry = foundryClient();
  if (!foundry) return NextResponse.json({ error: FOUNDRY_ERROR }, { status: 500 });

  const limit = rateLimit("draft", clientIp(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many drafts — wait ${limit.retryAfter}s and try again.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  // The body is read and checked *before* the quota is touched. It used to be
  // the other way round, and a malformed payload — a dropped connection
  // mid-POST, a client bug, an empty `purpose` — spent a draft off the month's
  // allowance and then answered 400. The visitor paid for a request that never
  // reached a model.
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

  // Every draft that gets here belongs to an account, so every draft comes out
  // of that account's monthly plan quota.
  //
  // Whose account is decided once, by the gate above — this used to ask
  // `getUser()` again, and that second call answers a failed request with
  // `user: null`, which read here as "no account to charge" and handed out a
  // free draft. `gate.userId` is the id the gate already verified; it is null
  // only on a deploy with no Supabase at all, where there is no quota to spend.
  const supabase = gate.userId ? await supabaseServer() : null;
  let charged = false;
  if (supabase) {
    // One statement checks and increments, so two drafts racing for the last
    // slot cannot both be granted it.
    const { data: allowed, error } = await supabase.rpc("consume_ai_draft");
    if (!error && allowed === false) {
      return NextResponse.json(
        {
          error:
            "You're out of AI drafts for this month. The composer still works — or see /pricing.",
        },
        { status: 402 },
      );
    }
    charged = !error;
  }

  /**
   * Put the slot back when the draft fails on our side. A 502 from Foundry is
   * our outage, not the visitor's draft, and charging for it is how a Free
   * plan's ten runs out at eight. Errors are swallowed: on a deploy that has
   * not run 0006 the function does not exist, and failing to refund must never
   * turn a 502 into a 500.
   */
  const refund = async () => {
    // rpc() resolves with `{ error }` rather than rejecting, so a missing
    // function is a value to ignore, not an exception to catch.
    if (charged && supabase) await supabase.rpc("refund_ai_draft");
  };

  const target =
    typeof raw.target === "string" && TARGET_IDS.has(raw.target as never)
      ? raw.target
      : "generic-mcp";
  const brief = buildBrief({
    purpose,
    domain: clamp(raw.domain, LIMITS.domain),
    tone: clamp(raw.tone, LIMITS.tone),
    target,
    teamName: clamp(raw.teamName, LIMITS.teamName),
  });

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
    await refund();
    return NextResponse.json(
      { error: `Foundry request failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 },
    );
  }

  let drafted: DraftedAgent;
  try {
    drafted = JSON.parse(text);
  } catch {
    await refund();
    return NextResponse.json({ error: "Foundry returned malformed JSON" }, { status: 502 });
  }

  if (!drafted.name || !drafted.role || !drafted.systemPrompt) {
    await refund();
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
