import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/foundry";
import { fetchCandidates, normalizeTerms } from "@/lib/skills-candidates";
import { requireAccount } from "@/lib/api-auth";

// The registry half of an onboarding draft, on its own. A browser running the
// draft against its own API key does the two model calls itself but still needs
// this list — skills.sh has no CORS headers, and the aitmpl overlay is a
// server-cached fetch. No model is called here, so it costs nothing to serve.

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Cheap to serve, but only /onboarding asks for it and /onboarding needs an
  // account — left open it is an unmetered scraping proxy for skills.sh
  // wearing our IP. Plain registry browsing has its own route, /api/skills,
  // which stays public because /skills is.
  const gate = await requireAccount("run a draft");
  if (!gate.ok) return gate.response;

  const limit = rateLimit("candidates", clientIp(req), 20);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests — wait ${limit.retryAfter}s and try again.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const terms = normalizeTerms((body as Record<string, unknown>)?.searchTerms);
  return NextResponse.json({ candidates: await fetchCandidates(terms) });
}
