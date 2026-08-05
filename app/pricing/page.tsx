"use client";

import Link from "next/link";
import { Nav, PoweredBy } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge } from "@/components/ui";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { usePlan } from "@/lib/use-plan";

const MASCOT = { free: "coffee", pro: "working", max: "rocket" } as const;

export default function PricingPage() {
  const { plan: current } = usePlan();

  return (
    <div>
      <Nav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-pixel text-xs sm:text-sm mb-1">PRICING</h1>
        <PoweredBy />
        <p className="mt-4 font-mono text-sm text-ink-soft max-w-lg">
          Compose and export on Free forever. Paid plans lift the caps and let
          your agents be served over MCP.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = current === id;
            return (
              <Panel key={id} className="p-5 flex flex-col min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[10px] uppercase">{plan.label}</span>
                  {isCurrent ? (
                    <Badge tone="coral">Your plan</Badge>
                  ) : (
                    id === "pro" && <Badge>Popular</Badge>
                  )}
                </div>

                <div className="grain mascot-stage relative pixel-border-sm p-4 my-4 self-center">
                  <Mascot state={MASCOT[id]} size={72} />
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl leading-none">{plan.price}</span>
                  {id !== "free" && (
                    <span className="font-mono text-[11px] text-muted">/ month</span>
                  )}
                </div>
                <p className="font-mono text-xs text-muted mt-1.5">{plan.blurb}</p>

                <ul className="mt-4 space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="font-mono text-xs text-ink-soft flex gap-2">
                      <span className="text-coral shrink-0">▸</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* No checkout is wired up yet, so these do not pretend to be
                    buy buttons — a dead "Subscribe" would be worse than an
                    honest label. */}
                <div className="mt-5">
                  {isCurrent ? (
                    <PixelButton variant="ghost" disabled className="w-full">
                      Current plan
                    </PixelButton>
                  ) : id === "free" ? (
                    <Link href="/new" className="block">
                      <PixelButton variant="ghost" className="w-full">
                        Start free →
                      </PixelButton>
                    </Link>
                  ) : (
                    <PixelButton variant="coral" disabled className="w-full">
                      Coming soon
                    </PixelButton>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>

        <p className="mt-6 font-mono text-[11px] text-muted">
          Billing isn&apos;t connected yet — Pro and Max are listed, not
          purchasable. Everything on Free works today, with or without an
          account.
        </p>
      </div>
      <Footer />
    </div>
  );
}
