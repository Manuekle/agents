import { fnv1a } from "@/components/dither-kit/pixel";

// Mascot state machine.
// Each state maps to a pixel-art asset slot + a motion signature + ASCII fallback.
// Drop PNGs into /public/mascots/<slot>.png and they replace the ASCII automatically.

export type MascotState =
  | "sleeping"
  | "thinking"
  | "working"
  | "cooking"
  | "coffee"
  | "rocket"
  | "headphones"
  | "paragliding"
  | "wizard"
  | "sherlock";

export interface MascotDef {
  slot: MascotState;
  label: string;
  anim: string; // css class from globals.css
  ascii: string; // fallback face
  blurb: string; // status line
}

export const MASCOTS: Record<MascotState, MascotDef> = {
  sleeping: {
    slot: "sleeping",
    label: "Sleeping",
    anim: "anim-sleeping",
    ascii: "(-_-) zzz",
    blurb: "agent is dormant",
  },
  thinking: {
    slot: "thinking",
    label: "Thinking",
    anim: "anim-thinking",
    ascii: "(o_o)?",
    blurb: "reasoning through the task",
  },
  working: {
    slot: "working",
    label: "Working",
    anim: "anim-working",
    ascii: "(>_<)",
    blurb: "executing tools",
  },
  cooking: {
    slot: "cooking",
    label: "Cooking",
    anim: "anim-cooking",
    ascii: "(^u^)",
    blurb: "assembling the build",
  },
  coffee: {
    slot: "coffee",
    label: "Coffee",
    anim: "anim-coffee",
    ascii: "(=^_^)c[]",
    blurb: "recharging context",
  },
  rocket: {
    slot: "rocket",
    label: "Shipping",
    anim: "anim-rocket",
    ascii: "(°o°)^",
    blurb: "deploying agent",
  },
  headphones: {
    slot: "headphones",
    label: "Focused",
    anim: "anim-headphones",
    ascii: "[o_o]",
    blurb: "deep focus mode",
  },
  paragliding: {
    slot: "paragliding",
    label: "Exploring",
    anim: "anim-paragliding",
    ascii: "(~_^)/",
    blurb: "scouting the codebase",
  },
  wizard: {
    slot: "wizard",
    label: "Casting",
    anim: "anim-wizard",
    ascii: "(⌐■_■)*",
    blurb: "invoking a skill",
  },
  sherlock: {
    slot: "sherlock",
    label: "Investigating",
    anim: "anim-sherlock",
    ascii: "(o_-)Q",
    blurb: "tracing the root cause",
  },
};

export const MASCOT_ORDER: MascotState[] = [
  "thinking",
  "working",
  "cooking",
  "sherlock",
  "wizard",
  "coffee",
  "headphones",
  "paragliding",
  "rocket",
  "sleeping",
];

/**
 * What a new specialist is given, in order.
 *
 * Every subagent used to be born "thinking", so six specialists on the canvas
 * were six identical sprites and the mascot stopped carrying any information.
 * Cycling means the nth specialist under an agent looks different from the
 * (n-1)th without anyone having to pick — and the picker is still there to
 * override it.
 *
 * `sleeping` is deliberately absent: it is the dormant state, and a specialist
 * that arrives asleep reads as broken rather than as new.
 */
export const SUBAGENT_MASCOTS: MascotState[] = [
  "thinking",
  "sherlock",
  "wizard",
  "headphones",
  "cooking",
  "paragliding",
  "coffee",
  "working",
  "rocket",
];

/**
 * A stable mascot for a node that has none — anything saved before subagents
 * carried one. Derived from the node's own id so it never changes under the
 * user, and so two specialists in one graph rarely land on the same sprite.
 */
export function mascotForSeed(seed: string): MascotState {
  return SUBAGENT_MASCOTS[fnv1a(seed) % SUBAGENT_MASCOTS.length];
}
