"use client";

import Link from "next/link";
import { BorderBeam } from "border-beam";
import { Mascot } from "@/components/Mascot";
import { Panel, PixelButton, Badge } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { PlanUsage } from "@/components/PlanUsage";
import { PLANS, PLAN_ORDER, formatLimit } from "@/lib/plans";
import { usePlan } from "@/lib/use-plan";
import { useSignedIn } from "@/lib/use-auth";
import { POLAR_CONFIGURED } from "@/lib/polar/env";

const MASCOT = { free: "coffee", pro: "working", max: "rocket" } as const;

// Your own key has no ceiling by construction — we are not paying for those
// calls — so the cell that has it says so rather than "yes".
const byok = (allowed: boolean) => (allowed ? "unmetered" : "—");

// What each tier actually reaches, route by route. "Guest" is not a plan — it
// is having no account at all — but it is the column people are standing in
// when they read this page, so leaving it out would answer the wrong question.
//
// Kept next to the cards rather than inside them because the interesting part
// is the *difference* between columns, and four bullet lists do not show that.
const MATRIX: { feature: string; where: string; guest: string; free: string; pro: string; max: string }[] = [
  { feature: "Watch the flow end to end", where: "/demo", guest: "yes", free: "yes", pro: "yes", max: "yes" },
  { feature: "Browse the registries", where: "/skills", guest: "yes", free: "yes", pro: "yes", max: "yes" },
  { feature: "Compose & export agents", where: "/build", guest: "—", free: "yes", pro: "yes", max: "yes" },
  { feature: "Saved agents", where: "/build", guest: "—", free: formatLimit(PLANS.free.agents), pro: formatLimit(PLANS.pro.agents), max: formatLimit(PLANS.max.agents) },
  { feature: "AI drafts a month", where: "/onboarding", guest: "—", free: formatLimit(PLANS.free.drafts), pro: formatLimit(PLANS.pro.drafts), max: formatLimit(PLANS.max.drafts) },
  { feature: "Bring your own API key", where: "/onboarding", guest: "—", free: byok(PLANS.free.byok), pro: byok(PLANS.pro.byok), max: byok(PLANS.max.byok) },
  { feature: "Share links", where: "/build", guest: "—", free: "yes", pro: "yes", max: "yes" },
  { feature: "Serve agents over MCP", where: "/mcp", guest: "—", free: PLANS.free.mcp ? "yes" : "—", pro: PLANS.pro.mcp ? "yes" : "—", max: PLANS.max.mcp ? "yes" : "—" },
  // Gated in app/api/docs/generate; it was missing from this table while the
  // plan cards sold it, which is the one direction a pricing page must not be
  // wrong in.
  { feature: "AI-filled context docs", where: "/build", guest: "—", free: PLANS.free.aiDocs ? "yes" : "—", pro: PLANS.pro.aiDocs ? "yes" : "—", max: PLANS.max.aiDocs ? "yes" : "—" },
];

function Cell({ value }: { value: string }) {
  const off = value === "—";
  return (
    <td
      className={`px-3 py-2 font-mono text-[11px] border-2 border-line text-center whitespace-nowrap ${
        off ? "text-muted" : "text-ink"
      }`}
    >
      {value}
    </td>
  );
}

export default function PricingPage() {
  const { plan: current } = usePlan();
  const guest = useSignedIn() === false;

  return (
    <div>
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="font-pixel text-xs sm:text-sm mb-1">PRICING</h1>        <p className="mt-4 font-mono text-sm text-ink-soft max-w-lg">
          Compose and export on Free forever. Paid plans lift the caps and let
          your agents be served over MCP.
        </p>

        {/* The tier above Free is having no account, and it is where a first-
            time reader is standing. Saying so here is more use than letting
            them find out by being redirected. */}
        <Panel className="mt-5 p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Badge tone={guest ? "coral" : "stone"}>No account</Badge>
          <p className="font-mono text-xs text-ink-soft flex-1 min-w-[16rem] leading-relaxed">
            Composing, drafting and MCP tokens all belong to an account, so
            signed out you get the demo and the registry — the whole build
            flow, on pre-loaded data, saving nothing.
          </p>
          <Link href="/demo">
            <PixelButton variant={guest ? "coral" : "ghost"}>
              <span className="inline-flex items-center gap-1.5">
                Open the demo
                <ArrowRightIcon size={12} />
              </span>
            </PixelButton>
          </Link>
        </Panel>

        {/* The columns below say what each plan allows; this says what the
            reader has actually used of theirs. Renders nothing signed out. */}
        <PlanUsage className="mt-5" />

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = current === id;
            const card = (
              <Panel className="p-5 flex flex-col min-w-0 h-full">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[10px] uppercase">{plan.label}</span>
                  {isCurrent ? (
                    <Badge tone="coral">Your plan</Badge>
                  ) : (
                    id === "pro" && <Badge>Popular</Badge>
                  )}
                </div>

                <div className="grain mascot-stage relative pixel-border-sm p-4 my-4 self-center">
                  {/* Static: three plan cards side by side, three idle loops
                      out of phase, and the eye never settles on the prices. */}
                  <Mascot state={MASCOT[id]} size={72} animate={false} />
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
                      {/* Decorative: the feature text beside it carries the
                          meaning, so it stays out of the accessibility tree. */}
                      <span aria-hidden="true" className="text-coral-text shrink-0">
                        ▸
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Until POLAR_CONFIGURED, these do not pretend to be buy
                    buttons — a dead "Subscribe" would be worse than an honest
                    label. See lib/polar/env.ts. */}
                <div className="mt-5">
                  {isCurrent ? (
                    <PixelButton variant="ghost" disabled className="w-full">
                      Current plan
                    </PixelButton>
                  ) : id === "free" ? (
                    // Free still means signing in — /new is gated — so a guest
                    // is sent to the sign-in rather than bounced off it.
                    <Link href={guest ? "/login?next=%2Fnew" : "/new"} className="block">
                      <PixelButton variant="ghost" className="w-full">
                        <span className="inline-flex items-center gap-1.5">
                          {guest ? "Sign in — it's free" : "Start free"}
                          <ArrowRightIcon size={12} />
                        </span>
                      </PixelButton>
                    </Link>
                  ) : !POLAR_CONFIGURED ? (
                    <PixelButton variant="coral" disabled className="w-full">
                      Coming soon
                    </PixelButton>
                  ) : guest ? (
                    // Checkout needs an account to attach the subscription to
                    // (see app/api/billing/checkout/route.ts) — sent to sign
                    // in first, same as Free.
                    <Link href={`/login?next=%2Fpricing`} className="block">
                      <PixelButton variant="coral" className="w-full">
                        <span className="inline-flex items-center gap-1.5">
                          Sign in to upgrade
                          <ArrowRightIcon size={12} />
                        </span>
                      </PixelButton>
                    </Link>
                  ) : (
                    // Plain <a>, not <Link>: this redirects straight into
                    // Polar's hosted checkout, so there is nothing to
                    // client-side navigate to.
                    <a href={`/api/billing/checkout?plan=${id}`} className="block">
                      <PixelButton variant="coral" className="w-full">
                        <span className="inline-flex items-center gap-1.5">
                          Upgrade to {plan.label}
                          <ArrowRightIcon size={12} />
                        </span>
                      </PixelButton>
                    </a>
                  )}
                </div>
              </Panel>
            );

            // The beam marks the one card that is meant to be read first, and
            // only that one. `borderRadius={0}` overrides its auto-detection —
            // left alone it rounds the glow off a corner that is square, and
            // the mismatch is the whole tell. `staticColors` kills the hue
            // cycle so it stays a warm coral breathe instead of a rainbow, and
            // `pulse-inner` keeps it contained rather than blooming over the
            // neighbouring cards. It honours prefers-reduced-motion itself.
            return id === "pro" ? (
              <BorderBeam
                key={id}
                size="pulse-inner"
                colorVariant="sunset"
                staticColors
                borderRadius={0}
                theme="auto"
                className="h-full"
              >
                {card}
              </BorderBeam>
            ) : (
              <div key={id} className="h-full">
                {card}
              </div>
            );
          })}
        </div>

        {/* WHAT EACH TIER REACHES */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-pixel text-sm">WHAT_YOU_GET</h2>
            <span className="font-mono text-[11px] text-muted">route by route</span>
          </div>
          {/* The table sets its own width from its content; without this it
              sizes the page and the whole document scrolls sideways on a
              phone instead of just the table. */}
          <Panel className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[36rem]">
              <thead>
                <tr>
                  <th className="px-3 py-2 border-2 border-line bg-stone text-left font-pixel text-[9px] uppercase">
                    Feature
                  </th>
                  {["No account", "Free", "Pro", "Max"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 border-2 border-line bg-stone font-pixel text-[9px] uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.feature}>
                    <th
                      scope="row"
                      className="px-3 py-2 border-2 border-line text-left font-normal"
                    >
                      <span className="font-mono text-[11px] block">{row.feature}</span>
                      <code className="font-mono text-[9px] text-muted">{row.where}</code>
                    </th>
                    <Cell value={row.guest} />
                    <Cell value={row.free} />
                    <Cell value={row.pro} />
                    <Cell value={row.max} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <p className="mt-6 font-mono text-[11px] text-muted max-w-2xl leading-relaxed">
          {POLAR_CONFIGURED
            ? "Pro and Max are billed through Polar. "
            : "Billing isn't connected yet — Pro and Max are listed, not purchasable, and a plan is set on the account by hand until it is. "}
          The caps are not decoration: the agent limit is a database trigger
          and the draft quota is checked and spent in one statement, so neither
          can be talked past from the browser.
        </p>
      </div>
    </div>
  );
}
