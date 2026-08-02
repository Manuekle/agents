import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Silkscreen } from "next/font/google";
import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-sans-stack",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
});

const pixel = Silkscreen({
  variable: "--font-pixel-stack",
  weight: ["400", "700"],
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
      className={`${sans.variable} ${mono.variable} ${pixel.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
