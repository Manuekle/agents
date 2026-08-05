import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { planOf } from "@/lib/plans";
import { clientIp, rateLimit } from "@/lib/foundry";
import { normalizeGraph } from "@/lib/graph";
import { agentSpec } from "@/lib/export";
import type { Agent } from "@/lib/types";

// What `@manudev.jsx/agents --token …` calls to fetch an agent from an
// account, so an agent served over MCP no longer has to live in a file on
// disk. Bearer token, not a session cookie: the caller is a CLI process.

export const runtime = "nodejs";

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value.trim() : null;
}

export async function GET(req: Request) {
  if (!SUPABASE_CONFIGURED) {
    return NextResponse.json({ error: "accounts are not enabled on this deploy" }, { status: 501 });
  }

  // Tokens are 256-bit so guessing is hopeless, but an unauthenticated
  // endpoint that hits the database on every call still deserves a ceiling.
  const limit = rateLimit("mcp", clientIp(req), 30);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  const token = bearer(req);
  if (!token) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }

  const agentId = new URL(req.url).searchParams.get("agent");

  // Plain client, no cookies: this request carries a token, not a session, and
  // the functions below are security-definer so the anon key is enough.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: resolved, error: resolveError } = await supabase.rpc("resolve_api_token", {
    raw_token: token,
  });

  if (resolveError) {
    return NextResponse.json({ error: "token lookup failed" }, { status: 502 });
  }

  const owner = Array.isArray(resolved) ? resolved[0] : null;
  if (!owner) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const plan = planOf(owner.plan);
  if (!plan.mcp) {
    return NextResponse.json(
      {
        error: `Serving agents over MCP isn't included in ${plan.label}. See ${new URL("/pricing", req.url).href}`,
      },
      { status: 402 },
    );
  }

  const { data: rows, error } = await supabase.rpc("agent_for_token", {
    raw_token: token,
    agent_id: agentId,
  });

  if (error) {
    return NextResponse.json({ error: "agent lookup failed" }, { status: 502 });
  }

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return NextResponse.json(
      { error: agentId ? `no agent "${agentId}" in this account` : "this account has no agents" },
      { status: 404 },
    );
  }

  // Same shape as the downloaded agents-dev.agent.json, so the MCP server has
  // one spec format whether it read a file or fetched this — including the
  // orchestrator/subagent tree, which is built here rather than sent raw so a
  // hand-edited or pre-canvas row still serves something coherent.
  const agent: Agent = {
    id: row.id,
    name: row.name,
    role: row.role ?? "",
    systemPrompt: row.system_prompt ?? "",
    target: "generic-mcp",
    model: row.model,
    temperature: row.temperature,
    skills: Array.isArray(row.skills) ? row.skills : [],
    mascot: "working",
    accent: "#f95c4b",
    createdAt: Date.now(),
  };
  const graph = normalizeGraph(row.graph, agent);

  return NextResponse.json(
    agentSpec({ ...agent, graph }),
    // A CLI may sit behind a shared proxy; this response is per-token.
    { headers: { "cache-control": "private, no-store" } },
  );
}
