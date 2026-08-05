"use client";

import Link from "next/link";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { SkillBrowser } from "@/components/SkillBrowser";
import { Panel, PixelButton, Badge } from "@/components/ui";

export default function SkillsPage() {
  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-pixel text-sm mb-1">SKILL_REGISTRY</h1>
            <PoweredBy />
          </div>
          <Badge tone="ink">skills.sh + aitmpl</Badge>
        </div>

        <Panel className="p-4 mb-6 flex items-start gap-3">
          <Mascot state="sherlock" size={44} className="shrink-0" />
          <div>
            <p className="font-mono text-xs">
              Two open registries. <strong>skills.sh</strong> is searched live;{" "}
              <strong>aitmpl</strong> browses skills, subagents, slash commands, MCP
              servers, hooks and settings by category, with the descriptions skills.sh
              does not publish. Copy an install, or compose an agent in{" "}
              <Link href="/build" className="text-coral underline">Build</Link> to bundle
              several.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <code className="inline-block bg-stone border-2 border-line px-2 py-1 font-mono text-[10px]">
                npx skills add &lt;owner/repo&gt;
              </code>
              <code className="inline-block bg-stone border-2 border-line px-2 py-1 font-mono text-[10px]">
                npx claude-code-templates@latest --skill &lt;cat/name&gt;
              </code>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <SkillBrowser showChart />
        </Panel>

        <div className="mt-6 text-center">
          <Link href="/build">
            <PixelButton variant="coral">Compose an agent →</PixelButton>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
