import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Habibi } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import "./globals.css";

const serif = Habibi({
  variable: "--font-serif-stack",
  weight: ["400"],
  subsets: ["latin"],
});

const TITLE = "agents — build AI agents, powered by ai";
const DESCRIPTION =
  "Craft AI agents with scraped skills for Claude Code, Codex & more. Pixel-native, MCP-ready.";

// Absolute base for og:image / twitter:image. Hardcoding a domain the project
// does not own points the social cards at someone else's host, so this reads
// the deployment: NEXT_PUBLIC_SITE_URL first, then the Vercel production
// domain, then localhost for `next dev`.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · agents" },
  description: DESCRIPTION,
  // app/icon.png, app/opengraph-image.png, app/twitter-image.png are auto-detected
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "agents",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${serif.variable} h-full antialiased`}
    >
      <head>
        <InlineScript
          html={`(function(){try{var t=localStorage.getItem("theme");if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`}
        />
      </head>
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
