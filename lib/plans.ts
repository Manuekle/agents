// Plan definitions. Prices are display-only for now — there is no payment
// provider wired up, so nothing here charges anyone; `plan` is set in the
// database by hand (or, later, by a billing webhook) and never by the client.

export type PlanId = "free" | "pro" | "max";

export interface Plan {
  id: PlanId;
  label: string;
  price: string;
  blurb: string;
  /** null means no cap. */
  agents: number | null;
  /** AI drafts per calendar month; null means no cap. */
  drafts: number | null;
  /** Serving an agent over MCP from the account. */
  mcp: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    price: "$0",
    blurb: "Compose, export, and see how it fits.",
    agents: 3,
    drafts: 10,
    mcp: false,
    features: [
      "3 saved agents",
      "10 AI drafts a month",
      "Full skills.sh registry",
      "Export to every target",
    ],
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: "$12",
    blurb: "For one person running real agents.",
    agents: 25,
    drafts: 200,
    mcp: true,
    features: [
      "25 saved agents",
      "200 AI drafts a month",
      "Serve agents over MCP",
      "Everything in Free",
    ],
  },
  max: {
    id: "max",
    label: "Max",
    price: "$40",
    blurb: "No ceilings.",
    agents: null,
    drafts: null,
    mcp: true,
    features: [
      "Unlimited agents",
      "Unlimited AI drafts",
      "Serve agents over MCP",
      "Everything in Pro",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "max"];

export function planOf(value: string | null | undefined): Plan {
  return PLANS[(value ?? "free") as PlanId] ?? PLANS.free;
}

/** "3" / "Unlimited" — one place so the UI and the errors agree. */
export function formatLimit(n: number | null): string {
  return n === null ? "Unlimited" : String(n);
}

// ------------------------------------------------------------------- usage
//
// The limits themselves bind in SQL (see supabase/migrations/0002_plans.sql):
// the agent cap is a trigger and the draft quota is checked and spent in one
// statement. Everything below is for telling the user where they stand *before*
// the database has to refuse them — a save that vanishes and reappears as an
// error is a much worse way to learn you are at three of three.

/** How many are left, or null when the plan has no cap. */
export function remaining(used: number, cap: number | null): number | null {
  return cap === null ? null : Math.max(0, cap - used);
}

/** True when the next one would be refused. Uncapped plans are never at one. */
export function atLimit(used: number, cap: number | null): boolean {
  return cap !== null && used >= cap;
}

/** "2 / 3" or "2 / ∞" — the shape every usage readout in the app uses. */
export function formatUsage(used: number, cap: number | null): string {
  return `${used} / ${cap === null ? "∞" : cap}`;
}

/** The plan one step up, or null at the top. What an "at your limit" nudge sells. */
export function nextPlanAfter(id: PlanId): Plan | null {
  const at = PLAN_ORDER.indexOf(id);
  return at >= 0 && at < PLAN_ORDER.length - 1 ? PLANS[PLAN_ORDER[at + 1]] : null;
}
