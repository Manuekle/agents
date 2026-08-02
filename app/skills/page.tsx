"use client";

import Link from "next/link";
import { Nav, PoweredBy } from "@/components/Nav";
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
          <Badge tone="ink">skills.sh</Badge>
        </div>

        <Panel className="p-4 mb-6 flex items-start gap-3">
          <Mascot state="sherlock" size={44} className="shrink-0" />
          <div>
            <p className="font-mono text-xs">
              Search the open agent-skills registry. Copy an install, or compose an
              agent in <Link href="/build" className="text-coral underline">Build</Link> to
              bundle several.
            </p>
            <code className="inline-block mt-2 bg-stone border-2 border-ink px-2 py-1 font-mono text-[10px]">
              npx skills add &lt;owner/repo&gt;
            </code>
          </div>
        </Panel>

        <Panel className="p-5">
          <SkillBrowser />
        </Panel>

        <div className="mt-6 text-center">
          <Link href="/build">
            <PixelButton variant="coral">Compose an agent →</PixelButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
