import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Every route is a static page — no dynamic segments to enumerate. Priorities
// rank the two entry points to creating an agent above the reference pages.
const ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/new", priority: 0.9 },
  { path: "/onboarding", priority: 0.8 },
  { path: "/build", priority: 0.8 },
  { path: "/skills", priority: 0.7 },
  { path: "/mcp", priority: 0.6 },
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
