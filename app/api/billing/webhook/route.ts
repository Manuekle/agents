import { NextResponse } from "next/server";
import { Webhooks } from "@polar-sh/nextjs";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { planForProduct } from "@/lib/polar/env";
import type { PlanId } from "@/lib/plans";

// What Polar calls on every subscription change. Authenticated by the HMAC
// signature @polar-sh/nextjs verifies from POLAR_WEBHOOK_SECRET before any
// handler below runs — there is no session here, so this is not listed as
// "account" in lib/access.ts the way the checkout route is.
//
// Writing `profiles.plan` still needs a second, unrelated secret
// (PLAN_SYNC_SECRET): profiles has no user update path to `plan` by design
// (0001_agents.sql), and this project never adds the Supabase service_role
// key, so the write goes through apply_polar_plan() — a security-definer
// function that checks the secret itself before touching a row. See
// supabase/migrations/0005_polar_billing.sql.

export const runtime = "nodejs";

type SubscriptionPayload = {
  data: {
    status: string;
    productId: string;
    customer: { externalId?: string | null };
  };
};

async function applyPlan(externalCustomerId: string | null | undefined, plan: PlanId) {
  const secret = process.env.PLAN_SYNC_SECRET;
  if (!externalCustomerId || !SUPABASE_CONFIGURED || !secret) return;

  // Plain client, no cookies: this is a server-to-server call carrying a
  // shared secret, not a user session — same shape as /api/mcp/agent's client.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.rpc("apply_polar_plan", {
    p_user_id: externalCustomerId,
    p_plan: plan,
    p_secret: secret,
  });

  // No error reporter is wired up on this deploy (see app/error.tsx) — a
  // server console line is the only record, but it beats a plan change
  // vanishing silently.
  if (error) console.error("[billing] apply_polar_plan failed:", error.message);
}

/** Created, updated, reactivated — anything that leaves a subscription active. */
async function onActive(payload: SubscriptionPayload) {
  const plan = planForProduct(payload.data.productId);
  const active = payload.data.status === "active" || payload.data.status === "trialing";
  if (!plan || !active) return;
  await applyPlan(payload.data.customer.externalId, plan);
}

/** Access actually ends here — `canceled` alone just turns off auto-renew. */
async function onRevoked(payload: SubscriptionPayload) {
  await applyPlan(payload.data.customer.externalId, "free");
}

const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

export const POST = webhookSecret
  ? Webhooks({
      webhookSecret,
      onSubscriptionCreated: onActive,
      onSubscriptionUpdated: onActive,
      onSubscriptionActive: onActive,
      onSubscriptionRevoked: onRevoked,
    })
  : async () =>
      NextResponse.json({ error: "billing is not configured on this deploy" }, { status: 501 });
