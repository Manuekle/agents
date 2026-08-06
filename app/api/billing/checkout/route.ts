import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/foundry";
import { requireAccount } from "@/lib/api-auth";
import { productIdFor } from "@/lib/polar/env";
import { polarClient, POLAR_ERROR } from "@/lib/polar/server";
import { SITE_URL } from "@/lib/site";

// Starts a Polar-hosted checkout for one plan and redirects into it.
//
// externalCustomerId is set here, from the verified session, and never from
// the query string a browser could send — trusting a client-supplied id would
// let anyone craft a link that points a real payment at someone else's
// account. Only `plan` comes from the query string, and it is checked against
// the two values this deploy actually recognizes before it reaches Polar.

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireAccount("subscribe to a paid plan");
  if (!gate.ok) return gate.response;

  // requireAccount passes with a null userId only on a deploy with no
  // Supabase at all (see lib/api-auth.ts) — there is no account to attach a
  // subscription to on one of those, so billing cannot run there either.
  if (!gate.userId) {
    return NextResponse.json({ error: "accounts are not enabled on this deploy" }, { status: 501 });
  }

  const limit = rateLimit("billing-checkout", clientIp(req), 10);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  const plan = new URL(req.url).searchParams.get("plan");
  if (plan !== "pro" && plan !== "max") {
    return NextResponse.json({ error: 'plan must be "pro" or "max"' }, { status: 422 });
  }

  const productId = productIdFor(plan);
  const polar = polarClient();
  if (!polar || !productId) {
    return NextResponse.json({ error: POLAR_ERROR }, { status: 500 });
  }

  let checkout: { url: string };
  try {
    checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: gate.userId,
      successUrl: `${SITE_URL}/build?checkout=success`,
    });
  } catch {
    return NextResponse.json({ error: "could not start checkout — try again" }, { status: 502 });
  }

  return NextResponse.redirect(checkout.url, { status: 303 });
}
