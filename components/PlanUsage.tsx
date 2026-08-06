"use client";

import Link from "next/link";
import { Badge, Panel, PixelButton } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";
import { clsx } from "@/lib/clsx";
import {
  PLANS,
  atLimit,
  formatUsage,
  nextPlanAfter,
  remaining,
  type Plan,
} from "@/lib/plans";
import { PLANS_ENABLED, usePlan } from "@/lib/use-plan";
import { useAgents, useAgentsLoading } from "@/lib/store";

// Where a user actually stands against their plan.
//
// The caps have always been real — the agent limit is a database trigger and
// the draft quota is spent in one statement — but nothing in the app said what
// they were or how much was left, so the first news of either was a save that
// rolled back or a draft that came back 402. These are the same two numbers,
// read from the same tables, shown before you hit them.

/** First of next month, in the viewer's locale — when the draft quota resets. */
function nextReset(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function Meter({
  label,
  used,
  cap,
  hint,
  pending,
}: {
  label: string;
  used: number;
  cap: number | null;
  hint?: string;
  /** The number is not known yet. Shows a dash rather than claiming zero. */
  pending?: boolean;
}) {
  const full = !pending && atLimit(used, cap);
  const left = remaining(used, cap);
  // Clamped: the trigger refuses the *next* row, so a plan downgrade can
  // legitimately leave someone over their cap, and a bar past 100% would
  // overflow its track rather than reading as "over".
  const pct = cap === null ? 0 : Math.min(100, Math.round((used / cap) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-pixel text-[9px] uppercase text-muted">{label}</span>
        <span
          className={clsx(
            "font-mono text-[11px] tabular-nums",
            full ? "text-coral-deep" : "text-ink",
          )}
        >
          {pending ? `— / ${cap === null ? "∞" : cap}` : formatUsage(used, cap)}
        </span>
      </div>
      {cap !== null && !pending && (
        // Decorative: the count above and the sentence below both say it in
        // text, so the bar itself stays out of the accessibility tree.
        <div
          aria-hidden="true"
          className="mt-1.5 h-2 border-2 border-line bg-stone overflow-hidden"
        >
          <div
            className={clsx("h-full transition-[width] duration-300", full ? "bg-coral-deep" : "bg-fill")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="mt-1 font-mono text-[10px] text-muted leading-snug">
        {pending
          ? "reading…"
          : cap === null
            ? "no cap on this plan"
            : full
              ? "none left"
              : `${left} left`}
        {!pending && hint && ` · ${hint}`}
      </p>
    </div>
  );
}

const WHAT = {
  agents: { noun: "saved agents", capOf: (p: Plan) => p.agents },
  drafts: { noun: "AI drafts", capOf: (p: Plan) => p.drafts },
} as const;

function Upsell({ plan, what }: { plan: Plan; what: keyof typeof WHAT }) {
  // Nothing to sell on the top plan — and Max has no caps to be out of, so
  // this never renders there anyway.
  const next = nextPlanAfter(plan.id);
  if (!next) return null;
  const { noun, capOf } = WHAT[what];
  return (
    <div className="mt-4 pt-4 border-t-2 border-line">
      <p className="font-mono text-[11px] text-ink-soft leading-relaxed">
        You&apos;re out of {noun} on {plan.label}. {next.label} lifts it to{" "}
        {capOf(next) ?? "unlimited"} for {next.price} a month.
      </p>
      <Link href="/pricing" className="block mt-2">
        <PixelButton variant="coral" className="w-full">
          <span className="inline-flex items-center gap-1.5">
            See plans
            <ArrowRightIcon size={12} />
          </span>
        </PixelButton>
      </Link>
    </div>
  );
}

/**
 * The full readout: plan, both meters, and an upsell only when something is
 * actually exhausted. Renders nothing signed out — a guest has no plan, and
 * the pages that show this already say what an account is for.
 */
export function PlanUsage({ className }: { className?: string }) {
  const { plan: planId, signedIn, draftsUsed, loading } = usePlan();
  const agents = useAgents();
  // The account's agents arrive on their own schedule; until they do, the list
  // is legitimately empty and "0 / 3 · 3 left" would be a claim, not a count.
  const agentsPending = useAgentsLoading();

  if (!PLANS_ENABLED || !signedIn || !planId) return null;
  const plan = PLANS[planId];

  return (
    <Panel className={clsx("p-4", className)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-pixel text-[10px] uppercase">Your plan</span>
        <Link href="/pricing">
          <Badge tone="coral">{plan.label}</Badge>
        </Link>
      </div>

      <div className="space-y-3">
        <Meter
          label="Saved agents"
          used={agents.length}
          cap={plan.agents}
          pending={agentsPending}
        />
        <Meter
          label="AI drafts this month"
          used={draftsUsed ?? 0}
          cap={plan.drafts}
          // Same reason: `loading` is the gap between signing in and the usage
          // row landing, and showing 0 there reads as "you have used none".
          pending={loading || draftsUsed === null}
          hint={`resets ${nextReset()}`}
        />
      </div>

      {!agentsPending && atLimit(agents.length, plan.agents) ? (
        <Upsell plan={plan} what="agents" />
      ) : draftsUsed !== null && atLimit(draftsUsed, plan.drafts) ? (
        <Upsell plan={plan} what="drafts" />
      ) : null}
    </Panel>
  );
}

/**
 * One line of the same thing, for page headers that have no room for the
 * panel. `kind` picks which number — the composer cares about agents, the
 * onboarding page about drafts.
 */
export function UsageChip({ kind }: { kind: "agents" | "drafts" }) {
  const { plan: planId, signedIn, draftsUsed } = usePlan();
  const agents = useAgents();
  const agentsPending = useAgentsLoading();

  if (!PLANS_ENABLED || !signedIn || !planId) return null;
  // Nothing rather than a wrong number: this sits in a header row, so a "0 / 3"
  // that corrects itself a beat later is a flicker in the most-watched spot on
  // the page.
  if (kind === "agents" && agentsPending) return null;
  if (kind === "drafts" && draftsUsed === null) return null;

  const plan = PLANS[planId];
  const used = kind === "agents" ? agents.length : (draftsUsed ?? 0);
  const cap = kind === "agents" ? plan.agents : plan.drafts;
  const full = atLimit(used, cap);

  return (
    <Link
      href="/pricing"
      title={`${plan.label} plan — ${formatUsage(used, cap)} ${kind === "agents" ? "saved agents" : "AI drafts this month"}`}
      className={clsx(
        "inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 border-2 transition-colors",
        full
          ? "border-coral-deep text-coral-deep hover:bg-stone"
          : "border-line text-muted hover:bg-stone hover:text-ink",
      )}
    >
      <span className="tabular-nums">{formatUsage(used, cap)}</span>
      <span>{kind === "agents" ? "agents" : "drafts"}</span>
    </Link>
  );
}
