import { PLANS, PLAN_ORDER, type Plan, type PlanId } from "./plans";

// Who may reach what.
//
// One table, read by the three places that must never disagree: `proxy.ts`
// (the redirect), the route handlers (the check that actually binds), and the
// nav (what it even offers). Anything missing from here is public — the
// default has to be the harmless one, so every path that costs money or
// touches an account is listed explicitly.

export type Access = "public" | "account";

interface Rule {
  /** Matches this path and everything under it. Longest match wins. */
  path: string;
  access: Access;
  why: string;
}

/** Where a signed-out visitor is sent instead of a gated page. */
export const DEMO_PATH = "/demo";

// Every `why` completes the sentence "it …", because that is how gateReason
// spends them.
const RULES: Rule[] = [
  // ---- pages ----
  { path: "/new", access: "account", why: "opens the composer" },
  { path: "/onboarding", access: "account", why: "spends AI drafts from a plan's monthly quota" },
  { path: "/build", access: "account", why: "creates and saves agents against the agent cap" },
  { path: "/mcp", access: "account", why: "issues API tokens that read an account" },

  // ---- api ----
  // Covers /api/onboarding/skills too: both halves of one draft run on our
  // Foundry deployment, so both cost money per call.
  { path: "/api/onboarding", access: "account", why: "runs our Foundry deployment on our bill" },
  // No model is called here, but it is the registry half of a draft and only
  // the onboarding page asks for it — leaving it open would be an unmetered
  // scraping proxy for skills.sh wearing our IP.
  { path: "/api/skills/candidates", access: "account", why: "is the registry half of a draft" },
  // Bring-your-own-key requests only, but it is still an outbound fetch made
  // from our address, and an open one is somebody else's free proxy.
  { path: "/api/ai/relay", access: "account", why: "forwards a request from our servers" },
  // Account-gated so the request carries an identity to plan-check; the plan
  // check itself (Pro/Max) lives in the route, next to the Foundry call it
  // guards — see planAllows("ai-docs").
  { path: "/api/docs/generate", access: "account", why: "runs our Foundry deployment on our bill" },
];

/**
 * Public and deliberately so, listed for the reader rather than the code:
 *
 *   /                 marketing
 *   /demo             the signed-out simulator — pre-loaded, saves nothing
 *   /skills           read-only registry browsing
 *   /pricing          the plans themselves
 *   /login /auth/*    how you stop being signed out
 *   /privacy /terms   required to be reachable
 *   /api/skills       what /skills and the command palette search
 *   /api/mcp/agent    authenticated by bearer token, not by session
 */
export function accessFor(pathname: string): Access {
  let best: Rule | null = null;
  for (const rule of RULES) {
    const hit = pathname === rule.path || pathname.startsWith(`${rule.path}/`);
    if (hit && (!best || rule.path.length > best.path.length)) best = rule;
  }
  return best?.access ?? "public";
}

export function requiresAccount(pathname: string): boolean {
  return accessFor(pathname) === "account";
}

/** Why a path is gated — used in the 401 body so the reason is not a mystery. */
export function gateReason(pathname: string): string {
  for (const rule of RULES) {
    if (pathname === rule.path || pathname.startsWith(`${rule.path}/`)) return rule.why;
  }
  return "an account";
}

// ------------------------------------------------------------------ features

/**
 * Capabilities a plan gates, as opposed to routes an account gates. Serving
 * over MCP and filling the AI context docs are the two today; the limits
 * (agents, drafts) are numbers on the plan and are enforced in SQL, not here.
 */
export type Feature = "mcp" | "ai-docs";

// `Feature` is spelled the way a URL or a UI label reads ("ai-docs"); `Plan`
// is spelled the way a TS property is ("aiDocs"). This is the one place that
// has to know both.
const FEATURE_FIELD: Record<Feature, "mcp" | "aiDocs"> = {
  mcp: "mcp",
  "ai-docs": "aiDocs",
};

export function planAllows(plan: PlanId | null | undefined, feature: Feature): boolean {
  if (!plan) return false;
  return PLANS[plan][FEATURE_FIELD[feature]];
}

/** The cheapest plan that includes a feature — what an upsell should name. */
export function cheapestPlanWith(feature: Feature): Plan {
  // PLAN_ORDER is cheapest-first, so the first hit is the one to sell.
  const field = FEATURE_FIELD[feature];
  return PLAN_ORDER.map((id) => PLANS[id]).find((p) => p[field]) ?? PLANS.max;
}
