// A/B experiments for the landing page. Two independent 50/50 tests run at
// once (a factorial design), so each can be read on its own in analytics:
//   pos    positioning: "reverse-engineer, then build yours" vs "their strategy, your plan"
//   hook   opener: founder authority/story vs curiosity/mechanism
// The design test is closed: the light "Editorial" design (b) won the review
// and is now the default. ?design=a still previews the old dark design.
// Assignment is random, sticky per visitor (cookie), and overridable with
// ?pos=a|b&hook=a|b&design=a|b for previews. ?ab=reset re-rolls.

export type Arm = "a" | "b";
export interface Variant {
  pos: Arm;
  hook: Arm;
  design: Arm;
}

export const EXPERIMENTS = ["pos", "hook", "design"] as const;
export const AB_COOKIE = "mm_ab";
export const UID_COOKIE = "mm_uid";

export function parseVariant(raw: string | undefined | null): Variant | null {
  const m = raw?.match(/^pos-([ab])\.hook-([ab])\.design-([ab])$/);
  return m ? { pos: m[1] as Arm, hook: m[2] as Arm, design: m[3] as Arm } : null;
}

export function serializeVariant(v: Variant): string {
  return `pos-${v.pos}.hook-${v.hook}.design-${v.design}`;
}

export function randomVariant(rand: () => number = Math.random): Variant {
  const pick = (): Arm => (rand() < 0.5 ? "a" : "b");
  return { pos: pick(), hook: pick(), design: "b" };
}

/** Analytics properties for every event, so results can be broken down per test. */
export function variantProps(v: Variant) {
  return {
    exp_pos: v.pos === "a" ? "a_reverse_build" : "b_strategy_plan",
    exp_hook: v.hook === "a" ? "a_founder" : "b_curiosity",
    exp_design: v.design === "a" ? "a_aurora" : "b_editorial",
    variant: serializeVariant(v),
  };
}

// ---------- Copy ----------
// Positioning sets the headline and the promise; the hook sets the opener
// (kicker + subheadline). Everything else is shared so the tests stay clean.

export const POSITIONING = {
  a: {
    // Big Domino: the fastest way to a strategy that works is to study one that already does.
    headline: ["Reverse-engineer your competitors'", "marketing strategies."],
    accent: "Then build yours.",
    cta: "Reverse-engineer a competitor free",
    finalHeadline: "Study what already works. Then build yours.",
    proLabel: "Then build your own plan from it",
  },
  b: {
    headline: ["Your competitor's marketing strategy,", "reverse-engineered."],
    accent: "Your plan, built from it.",
    cta: "Get my free playbook",
    finalHeadline: "Your competitors already did the testing. Build your strategy on their answers.",
    proLabel: "Get the full plan for your brand",
  },
} as const;

export const HOOK = {
  a: {
    // Founder authority + story opener.
    kicker: "18 years of brand building, in one tool",
    sub: "Every brand transformation starts the same way: studying what already works. Paste any competitor's URL, get their channels, content, funnel and offer as a free PDF, then build your own strategy from it.",
  },
  b: {
    // Curiosity / mechanism opener.
    kicker: "Every website leaks its marketing",
    sub: "The pixels it fires, the pages it builds, the offers it tests, the emails it collects. We read the leaks on any public site, hand you their strategy as a free PDF, and help you build yours.",
  },
} as const;

export function copyFor(v: Variant) {
  return { ...POSITIONING[v.pos], ...HOOK[v.hook] };
}
