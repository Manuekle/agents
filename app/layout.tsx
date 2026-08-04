import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Habibi, Silkscreen } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const serif = Habibi({
  variable: "--font-serif-stack",
  weight: ["400"],
  subsets: ["latin"],
});

// A real bitmap face for the label role — the site is pixel-art throughout and
// `.font-pixel` used to be Geist Mono in disguise. Silkscreen is drawn on an
// 8px grid, so it stays crisp at the 10-11px the labels actually render at.
const pixel = Silkscreen({
  variable: "--font-pixel-stack",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const TITLE = "agents — build AI agents, powered by ai";
const DESCRIPTION =
  "Craft AI agents with scraped skills for Claude Code, Codex & more. Pixel-native, MCP-ready.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · agents" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
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

// Tints the mobile browser chrome to match whichever theme is showing, so the
// status bar doesn't sit on a colour the page never uses.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${serif.variable} ${pixel.variable} h-full antialiased`}
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
