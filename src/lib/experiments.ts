// A/B experiments for the landing page. Three independent 50/50 tests run at
// once (a factorial design), so each can be read on its own in analytics:
//   pos    positioning: "spy" (see how they win) vs "plan" (get your plan)
//   hook   opener: pain/story vs curiosity/mechanism
//   design visual: dark "Aurora" vs light "Editorial"
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
  return { pos: pick(), hook: pick(), design: pick() };
}

/** Analytics properties for every event, so results can be broken down per test. */
export function variantProps(v: Variant) {
  return {
    exp_pos: v.pos === "a" ? "a_spy" : "b_plan",
    exp_hook: v.hook === "a" ? "a_pain" : "b_curiosity",
    exp_design: v.design === "a" ? "a_aurora" : "b_editorial",
    variant: serializeVariant(v),
  };
}

// ---------- Copy ----------
// Positioning sets the headline and the promise; the hook sets the opener
// (kicker + subheadline). Everything else is shared so the tests stay clean.

export const POSITIONING = {
  a: {
    // "Spy": curiosity + competitive fear. Big Domino: a competitor's marketing is visible if you know where to look.
    headline: ["See exactly how your competitor", "gets customers."],
    accent: "In 60 seconds.",
    cta: "Reverse-engineer them free",
    finalHeadline: "Your competitor already did the testing. Read their answers.",
    proLabel: "Then turn it into your own plan",
  },
  b: {
    // "Plan": outcome + save time. Big Domino: the fastest plan is one built on what already works.
    headline: ["Get a marketing plan built on what", "already works for your competitor."],
    accent: "Not guesses.",
    cta: "Get my free playbook",
    finalHeadline: "Stop guessing. Start from a playbook that's already working.",
    proLabel: "Get the full plan for your brand",
  },
} as const;

export const HOOK = {
  a: {
    // Pain / story opener.
    kicker: "For founders tired of guessing",
    sub: "Your competitor didn't get lucky. They run a playbook: the channels, content, funnel and offer that bring them customers every day. Paste their URL and get that playbook as a free PDF.",
  },
  b: {
    // Curiosity / mechanism opener.
    kicker: "Every website leaks its marketing",
    sub: "The pixels it fires, the pages it builds, the offers it tests, the emails it collects. We read the leaks on any public site and hand you the playbook as a free PDF.",
  },
} as const;

export function copyFor(v: Variant) {
  return { ...POSITIONING[v.pos], ...HOOK[v.hook] };
}
