import type { NextConfig } from "next";

// Response headers the app had none of.
//
// Two of these matter more here than they would on a brochure site:
//
//   - `frame-ancestors 'none'` (plus the legacy X-Frame-Options twin). Sessions
//     are cookie-backed and the composer is one click deep, so a page that can
//     be framed is a page whose signed-in state can be driven from someone
//     else's site.
//   - `form-action 'self'` / `base-uri 'self'`. The visitor's own provider API
//     key lives in this origin's web storage (lib/ai/settings.ts says so out
//     loud), which makes injected markup that retargets a form or rewrites
//     relative URLs the cheapest way to move it somewhere else.
//
// Deliberately NOT here: a `script-src`. A useful one needs a per-request nonce
// threaded through the proxy, and the inline theme script in app/layout.tsx
// means the only alternative is `'unsafe-inline'`, which buys nothing. Shipping
// that would leave a CSP header that reads like protection and is not. Left as
// the one open item, tracked rather than faked.
//
// `connect-src` is likewise absent on purpose: bring-your-own-key drafts fetch
// whatever base URL the visitor typed, so any allow-list narrow enough to be
// worth having would break the feature it is supposed to protect.
const CSP = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // `strict-origin-when-cross-origin` is already the browser default, but an
  // explicit value is what stops a future proxy or host from loosening it.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in the app asks for any of these, so nothing embedded in it should
  // be able to either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Ignored over plain HTTP, so `next dev` on localhost is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // The version banner is a free hint about which advisories apply to us.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
