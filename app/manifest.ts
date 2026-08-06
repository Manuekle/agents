import type { MetadataRoute } from "next";

// Home-screen identity for Android/Chrome. There is no service worker here, so
// this is about the icon and name a bookmark gets — not an installable PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "agents — build AI agents, ship your skills",
    short_name: "agents",
    description:
      "Craft AI agents with scraped skills for Claude Code, Codex & more. Pixel-native, MCP-ready.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#ef5c47",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-mark.png", sizes: "128x128", type: "image/png" },
    ],
  };
}
