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
