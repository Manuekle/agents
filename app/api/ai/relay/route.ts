import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { clientIp, rateLimit } from "@/lib/foundry";
import { requireAccount } from "@/lib/api-auth";

// Forwards one bring-your-own-key request to the provider the browser could
// not reach itself. Some vendors send no CORS headers at all, so a page cannot
// call them directly; this hop exists only for that case.
//
// It holds nothing. The key arrives in a header, is passed straight through,
// and is gone when the response returns — nothing is logged, cached or stored.
// Local endpoints are refused outright: they are unreachable from here anyway,
// and pretending otherwise would only turn this into a port scanner.

export const runtime = "nodejs";

// An open forwarder is an SSRF hole, so this is deliberately narrow: only the
// headers a model API actually needs, only https, and only public addresses.
const ALLOWED_HEADERS = new Set([
  "content-type",
  "authorization",
  "x-api-key",
  "api-key",
  "anthropic-version",
  "anthropic-beta",
  "anthropic-dangerous-direct-browser-access",
  "openai-organization",
  "openai-project",
  "http-referer",
  "x-title",
]);

const MAX_BODY = 256 * 1024;
const TIMEOUT_MS = 60_000;

/** RFC1918, loopback, link-local, CGNAT, ULA — anything not routable publicly. */
function isPrivateAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (v === 6) {
    const addr = address.toLowerCase();
    if (addr === "::1" || addr === "::") return true;
    if (addr.startsWith("fe80") || addr.startsWith("fc") || addr.startsWith("fd")) return true;
    // IPv4-mapped (::ffff:10.0.0.1) hides a private v4 address inside a v6 one.
    const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

async function reason(url: URL): Promise<string | null> {
  if (url.protocol !== "https:") return "only https endpoints can be relayed";
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return "local endpoints must be called directly from your browser";
  }

  // Resolve before allowing the request: a public-looking hostname can point
  // at 127.0.0.1 or a metadata endpoint just as easily as a literal IP.
  if (isIP(host)) {
    return isPrivateAddress(host) ? "that address is not routable" : null;
  }
  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return "host did not resolve";
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      return "that host resolves to a private address";
    }
  } catch {
    return "host did not resolve";
  }
  return null;
}

export async function POST(req: Request) {
  // The relay spends our bandwidth, not our model budget — but an outbound
  // fetch made from our address, by anyone, is somebody else's free proxy no
  // matter how narrow the allow-list below is. The only caller is the
  // bring-your-own-key draft on /onboarding, which needs an account anyway.
  const gate = await requireAccount("relay a request to your provider");
  if (!gate.ok) return gate.response;

  // A ceiling on top of that: an account is not a licence to hammer it.
  const limit = rateLimit("relay", clientIp(req), 20);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let payload: { url?: unknown; headers?: unknown; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 422 });
  }

  if (typeof payload.url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 422 });
  }

  let url: URL;
  try {
    url = new URL(payload.url);
  } catch {
    return NextResponse.json({ error: "url is not a valid URL" }, { status: 422 });
  }

  // 422 rather than 400 throughout: the client retries a 400 as a "provider
  // rejected the schema" case, and a rejection from this route is not that.
  const blocked = await reason(url);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 422 });

  const headers: Record<string, string> = {};
  if (payload.headers && typeof payload.headers === "object") {
    for (const [name, value] of Object.entries(payload.headers as Record<string, unknown>)) {
      if (typeof value === "string" && ALLOWED_HEADERS.has(name.toLowerCase())) {
        headers[name.toLowerCase()] = value;
      }
    }
  }
  headers["content-type"] ??= "application/json";

  const body = JSON.stringify(payload.body ?? {});
  if (body.length > MAX_BODY) {
    return NextResponse.json({ error: "request body too large" }, { status: 422 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "error", // A redirect could land somewhere the checks above rejected.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `could not reach ${url.host}: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 },
    );
  }

  // Status and body pass through untouched so the caller sees the provider's
  // own error — "invalid api key" is far more useful than "relay failed".
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
