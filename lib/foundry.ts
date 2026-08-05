import OpenAI from "openai";

// Shared plumbing for the Azure AI Foundry routes. The onboarding draft and
// the skill pick are separate endpoints so the persona can render while the
// registry lookup is still running, and both need the same client, guardrails
// and input clamps.

export const FOUNDRY_ERROR =
  "Foundry not configured — set AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY and AZURE_FOUNDRY_DEPLOYMENT";

/** Env-backed client, or null when the deployment isn't configured. */
export function foundryClient(): { client: OpenAI; model: string } | null {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const model = process.env.AZURE_FOUNDRY_DEPLOYMENT;
  if (!endpoint || !apiKey || !model) return null;
  return { client: new OpenAI({ baseURL: endpoint, apiKey }), model };
}

// ---- rate limit ----------------------------------------------------------
// These endpoints spend real money on every call, so they cannot be an open
// faucet. Fixed window per IP, held in process memory: Fluid Compute reuses
// instances across requests, so this reliably stops one client hammering the
// form. It is NOT a distributed guarantee — traffic spread across instances
// gets a proportionally higher ceiling. A durable store (KV/Redis) would be
// the upgrade if this ever sees real volume.
const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 10_000;

// Each bucket is its own map, so drafting does not eat the allowance for the
// skill pick that follows it — one draft is one call to each.
const buckets = new Map<string, Map<string, { count: number; resetAt: number }>>();

export function rateLimit(
  bucket: string,
  ip: string,
  max = 5,
): { ok: true } | { ok: false; retryAfter: number } {
  let hits = buckets.get(bucket);
  if (!hits) {
    hits = new Map();
    buckets.set(bucket, hits);
  }

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
  if (entry.count > max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// ---- input ---------------------------------------------------------------
// The caps live in lib/ai/brief so the browser can build the same brief for a
// bring-your-own-key draft without importing the OpenAI client above.
export { LIMITS, clamp } from "./ai/brief";
