import type { CompetitorTeardown, ProPlan } from "./types";

// Free models drift from the schema. These coercers turn whatever came back into
// the exact shape the UI and PDF expect, dropping junk instead of crashing.

type Obj = Record<string, unknown>;

export function cleanText(v: unknown, max = 1200): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v);
  return s
    .replace(/\s*[—–]\s*/g, ", ") // no em or en dashes in output
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown, max?: number) => cleanText(v, max);
const strs = (v: unknown, n = 20): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []).map((x) => str(x, 400)).filter(Boolean).slice(0, n);
const arr = <T>(v: unknown, f: (o: Obj, i: number) => T | null, n = 30): T[] =>
  (Array.isArray(v) ? v : [])
    .map((x, i) => f(obj(x), i))
    .filter((x): x is T => x !== null)
    .slice(0, n);
function oneOf<T extends string>(v: unknown, allowed: readonly T[], dflt: T): T {
  const s = str(v).toLowerCase();
  return (allowed.find((a) => a.toLowerCase() === s) ?? dflt) as T;
}

export function normalizeTeardown(raw: unknown, base: Pick<CompetitorTeardown, "competitor" | "url" | "generatedAt" | "engine">): CompetitorTeardown {
  const r = obj(raw);
  const p = obj(r.positioning);
  const a = obj(r.audience);
  const c = obj(r.content);
  const s = obj(r.seo);
  const f = obj(r.funnel);
  return {
    ...base,
    summary: str(r.summary, 2000),
    positioning: {
      oneLiner: str(p.oneLiner),
      targetAudience: str(p.targetAudience),
      awarenessStage: str(p.awarenessStage),
      sophisticationStage: str(p.sophisticationStage),
      coreOffer: str(p.coreOffer),
      primaryCta: str(p.primaryCta),
    },
    audience: { segments: strs(a.segments), painsAddressed: strs(a.painsAddressed), objectionsHandled: strs(a.objectionsHandled) },
    channels: arr(r.channels, (o) =>
      str(o.channel)
        ? {
            channel: str(o.channel, 60),
            status: oneOf(o.status, ["active", "likely", "absent", "unknown"] as const, "unknown"),
            evidence: str(o.evidence, 400),
            role: str(o.role, 300),
          }
        : null,
    ),
    content: {
      pillars: strs(c.pillars),
      formats: strs(c.formats),
      cadence: str(c.cadence),
      ctaPattern: str(c.ctaPattern),
      hookStyle: str(c.hookStyle),
    },
    seo: { pageTypes: strs(s.pageTypes), programmatic: strs(s.programmatic), keywordThemes: strs(s.keywordThemes), observations: strs(s.observations) },
    funnel: {
      entryOffer: str(f.entryOffer),
      coreOffer: str(f.coreOffer),
      pricingModel: str(f.pricingModel),
      upgradeGate: str(f.upgradeGate),
      steps: strs(f.steps, 10),
    },
    techStack: strs(r.techStack, 30),
    whatWorks: arr(r.whatWorks, (o) =>
      str(o.tactic)
        ? {
            tactic: str(o.tactic, 300),
            evidence: str(o.evidence, 400),
            whyItWorks: str(o.whyItWorks, 400),
            transferable: oneOf(o.transferable, ["yes", "no", "modified"] as const, "modified"),
            costToCopy: str(o.costToCopy, 120),
          }
        : null,
      12,
    ),
    gaps: strs(r.gaps, 12),
    quickWins: strs(r.quickWins, 8),
  };
}

export function normalizePlan(raw: unknown, base: Pick<ProPlan, "brandName" | "domain">): ProPlan {
  const r = obj(raw);
  const p = obj(r.positioning);
  const i = obj(r.icp);
  const cp = obj(r.contentPlan);
  const seo = obj(r.seoPlan);
  const ads = obj(r.adsPlan);
  const em = obj(r.emailPlan);
  return {
    ...base,
    executiveSummary: str(r.executiveSummary, 2500),
    positioning: { statement: str(p.statement, 600), differentiators: strs(p.differentiators), messagingPillars: strs(p.messagingPillars), taglines: strs(p.taglines, 6) },
    icp: { primary: str(i.primary, 500), secondary: str(i.secondary, 500), pains: strs(i.pains), triggers: strs(i.triggers), whereTheyGather: strs(i.whereTheyGather) },
    strategies: arr(r.strategies, (o) =>
      str(o.name)
        ? { name: str(o.name, 120), objective: str(o.objective, 300), borrowedMechanism: str(o.borrowedMechanism, 400), ourTwist: str(o.ourTwist, 400), whyItWillWork: str(o.whyItWillWork, 400) }
        : null,
      8,
    ),
    channelPlan: arr(r.channelPlan, (o) =>
      str(o.channel)
        ? { channel: str(o.channel, 60), priority: oneOf(o.priority, ["P1", "P2", "P3"] as const, "P2"), goal: str(o.goal, 300), tactics: strs(o.tactics, 6), kpi: str(o.kpi, 200), effort: str(o.effort, 120) }
        : null,
      10,
    ),
    executionPlan: arr(r.executionPlan, (o) =>
      str(o.phase)
        ? {
            phase: str(o.phase, 40),
            focus: str(o.focus, 300),
            tasks: arr(o.tasks, (t) => (str(t.task) ? { task: str(t.task, 300), hours: str(t.hours, 40), metric: str(t.metric, 200), killRule: str(t.killRule, 200) } : null), 8),
          }
        : null,
      4,
    ),
    contentPlan: {
      pillars: arr(cp.pillars, (o) => (str(o.name) ? { name: str(o.name, 100), purpose: str(o.purpose, 300), topics: strs(o.topics, 8) } : null), 6),
      calendar: arr(cp.calendar, (o, idx) =>
        str(o.title)
          ? { week: Number(o.week) || idx + 1, title: str(o.title, 200), format: str(o.format, 40), channel: str(o.channel, 60), funnelStage: str(o.funnelStage, 10), keyword: str(o.keyword, 100) }
          : null,
        16,
      ),
      repurposingChain: strs(cp.repurposingChain, 12),
      template: strs(cp.template, 12),
    },
    seoPlan: {
      keywords: arr(seo.keywords, (o) => (str(o.keyword) ? { keyword: str(o.keyword, 100), intent: str(o.intent, 30), pageType: str(o.pageType, 60) } : null), 25),
      pageTypesToBuild: strs(seo.pageTypesToBuild, 10),
      programmaticIdea: str(seo.programmaticIdea, 600),
    },
    adsPlan: {
      angles: arr(ads.angles, (o) => (str(o.angle) ? { angle: str(o.angle, 80), hook: str(o.hook, 300), offer: str(o.offer, 200), format: str(o.format, 80) } : null), 8),
      budgetGuidance: str(ads.budgetGuidance, 600),
    },
    emailPlan: {
      leadMagnet: str(em.leadMagnet, 300),
      sequence: arr(em.sequence, (o, idx) => (str(o.subject) ? { day: Number(o.day) || (idx === 0 ? 0 : idx * 2), subject: str(o.subject, 150), goal: str(o.goal, 200) } : null), 10),
    },
    swipeFile: arr(r.swipeFile, (o) =>
      str(o.mechanism)
        ? { mechanism: str(o.mechanism, 300), whyItWorks: str(o.whyItWorks, 300), blankVersion: str(o.blankVersion, 500), yourVersion: str(o.yourVersion, 500) }
        : null,
      10,
    ),
    gapsToExploit: strs(r.gapsToExploit, 10),
    kpis: arr(r.kpis, (o) => (str(o.metric) ? { metric: str(o.metric, 100), target30: str(o.target30, 80), target90: str(o.target90, 80) } : null), 10),
    risks: strs(r.risks, 10),
  };
}
