"use client";

import Link from "next/link";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge } from "@/components/ui";

export default function NewAgentPage() {
  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="font-pixel text-sm mb-1">CREATE_AGENT</h1>
        <PoweredBy />
        <p className="mt-4 font-mono text-sm text-ink-soft max-w-lg">
          Two ways in — let an AI draft the persona, or build every field yourself.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Link href="/onboarding" className="group block">
            <Panel className="p-6 h-full flex flex-col">
              <Badge tone="coral">AI-assisted</Badge>
              <div className="grain mascot-stage relative pixel-border-sm p-6 my-4 self-center">
                <Mascot state="wizard" size={96} />
              </div>
              <h2 className="font-sans font-bold text-lg">Onboarding</h2>
              <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed flex-1">
                Answer a few questions, an Azure AI Foundry model drafts the
                name, role &amp; system prompt, then searches skills.sh and
                picks the skills that fit. You land in the composer to review
                and save.
              </p>
              <PixelButton variant="coral" className="mt-4 w-full group-hover:brightness-95">
                Start onboarding →
              </PixelButton>
            </Panel>
          </Link>

          <Link href="/build" className="group block">
            <Panel className="p-6 h-full flex flex-col">
              <Badge>Manual</Badge>
              <div className="grain mascot-stage relative pixel-border-sm p-6 my-4 self-center">
                <Mascot state="working" size={96} />
              </div>
              <h2 className="font-sans font-bold text-lg">Personalizado</h2>
              <p className="font-mono text-xs text-muted mt-1.5 leading-relaxed flex-1">
                Go straight to the composer — write the name, role, system
                prompt, model &amp; skills yourself, field by field.
              </p>
              <PixelButton variant="ghost" className="mt-4 w-full">
                Open composer →
              </PixelButton>
            </Panel>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
