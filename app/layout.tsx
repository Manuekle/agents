import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Silkscreen, Habibi } from "next/font/google";
import "./globals.css";

const pixel = Silkscreen({
  variable: "--font-pixel-stack",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const serif = Habibi({
  variable: "--font-serif-stack",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AGENT FORGE — build AI agents, powered by ai",
  description:
    "Craft AI agents with scraped skills for Claude Code, Codex & more. Pixel-native, MCP-ready.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${pixel.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
