import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Habibi } from "next/font/google";
import "./globals.css";

const serif = Habibi({
  variable: "--font-serif-stack",
  weight: ["400"],
  subsets: ["latin"],
});

const TITLE = "agents — build AI agents, powered by ai";
const DESCRIPTION =
  "Craft AI agents with scraped skills for Claude Code, Codex & more. Pixel-native, MCP-ready.";

export const metadata: Metadata = {
  metadataBase: new URL("https://agents.dev"),
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
