// String-only config, safe to import from a "use client" file: the pricing
// page reads POLAR_CONFIGURED to decide whether "Upgrade" is a real button or
// the honest "Coming soon" it shows while billing isn't wired up. Anything
// that touches the @polar-sh/sdk client itself lives in ./server instead —
// that package has no business in the browser bundle.
//
// Product ids are not secret: one is meaningless without the access token
// that can actually check someone out with it, so NEXT_PUBLIC_ is the right
// place for them, same reasoning as the Supabase anon key.

export const POLAR_SERVER: "sandbox" | "production" =
  process.env.POLAR_SERVER === "production" ? "production" : "sandbox";

const PRODUCT_ID: Record<"pro" | "max", string> = {
  pro: process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID || "",
  max: process.env.NEXT_PUBLIC_POLAR_MAX_PRODUCT_ID || "",
};

/** Both paid products configured — the gate the pricing page renders behind. */
export const POLAR_CONFIGURED = Boolean(PRODUCT_ID.pro && PRODUCT_ID.max);

export function productIdFor(plan: "pro" | "max"): string | null {
  return PRODUCT_ID[plan] || null;
}

/** The plan a Polar product id sells, or null for a product this deploy doesn't recognize. */
export function planForProduct(productId: string): "pro" | "max" | null {
  if (productId === PRODUCT_ID.pro) return "pro";
  if (productId === PRODUCT_ID.max) return "max";
  return null;
}
