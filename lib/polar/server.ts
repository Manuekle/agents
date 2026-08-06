import { Polar } from "@polar-sh/sdk";
import { POLAR_SERVER } from "./env";

// Server-only: the SDK client and the checkout route's error string. Mirrors
// lib/foundry.ts's foundryClient() — null, not thrown, when the deployment
// isn't configured, so a self-hosted instance with no billing provider still
// builds and runs.

export const POLAR_ERROR =
  "Billing not configured — set POLAR_ACCESS_TOKEN, NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID and NEXT_PUBLIC_POLAR_MAX_PRODUCT_ID";

export function polarClient(): Polar | null {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) return null;
  return new Polar({ accessToken, server: POLAR_SERVER });
}
