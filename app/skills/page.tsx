"use client";

import Link from "next/link";
import { PoweredBy } from "@/components/PoweredBy";
import { Mascot } from "@/components/Mascot";
import { SkillBrowser } from "@/components/SkillBrowser";
import { Panel, PixelButton, Badge } from "@/components/ui";
import { useSignedIn } from "@/lib/use-auth";

export default function SkillsPage() {
  // Browsing is public; composing is not. Both CTAs on this page point at the
  // composer, so signed out they have to say so rather than bounce.
  const guest = useSignedIn() === false;

  return (
    <div>
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
              does not publish. Copy an install here — no account needed — or{" "}
              <Link
                href={guest ? "/demo?from=%2Fbuild" : "/build"}
                className="text-coral-text underline"
              >
                {guest ? "see how several get bundled into one agent" : "bundle several into one agent"}
              </Link>
              .
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

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {guest ? (
            <>
              <Link href="/demo">
                <PixelButton variant="coral">Watch an agent get composed →</PixelButton>
              </Link>
              <Link href="/login?next=%2Fbuild">
                <PixelButton variant="ghost">Sign in to compose one</PixelButton>
              </Link>
            </>
          ) : (
            <Link href="/build">
              <PixelButton variant="coral">Compose an agent →</PixelButton>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
