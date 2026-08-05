import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Every route is a static page — no dynamic segments to enumerate.
//
// Only the ones a signed-out crawler can actually read. /new, /onboarding,
// /build and /mcp all redirect to /demo without a session, so listing them
// would be advertising a page that answers 307 to everyone who follows it.
// The demo is what those routes look like from outside, so it takes their
// place at the top.
const ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/demo", priority: 0.9 },
  { path: "/pricing", priority: 0.8 },
  { path: "/skills", priority: 0.7 },
  { path: "/login", priority: 0.5 },
  { path: "/privacy", priority: 0.3 },
  { path: "/terms", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority,
  }));
}
