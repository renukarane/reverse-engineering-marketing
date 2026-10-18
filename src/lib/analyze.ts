import { aiConfigured, chatJson } from "./ai";
import { crawlSite } from "./crawler";
import { brandFrom, rulePlan, ruleTeardown } from "./fallback";
import { normalizePlan, normalizeTeardown } from "./normalize";
import { planPrompts, teardownPrompt, type BrandInput } from "./prompts";
import type { CompetitorTeardown, ProPlan, Report, SiteSignals } from "./types";

export async function buildTeardown(s: SiteSignals): Promise<CompetitorTeardown> {
  const base = { competitor: brandFrom(s), url: s.finalUrl, generatedAt: new Date().toISOString() };
  if (aiConfigured()) {
    try {
      const { system, user } = teardownPrompt(s);
      const { data, engine } = await chatJson(system, user, 5000);
      const t = normalizeTeardown(data, { ...base, engine });
      // Keep observed tech stack authoritative; models sometimes drop it.
      if (!t.techStack.length) t.techStack = s.tech.map((x) => `${x.name} (${x.category})`);
      if (t.summary && t.channels.length) return t;
    } catch (e) {
      console.warn("[teardown] AI failed, using rules:", (e as Error).message);
    }
  }
  return { ...base, engine: "Rule-based (no AI)", ...ruleTeardown(s) };
}

export async function buildPlan(t: CompetitorTeardown, b: BrandInput, own: SiteSignals | null): Promise<ProPlan> {
  const base = { brandName: b.brandName, domain: b.domain };
  const fallback = rulePlan(t, b, own);
  if (!aiConfigured()) return { ...base, ...fallback };

  // Three smaller calls, run one after another so free-tier token-per-minute limits hold.
  const merged: Record<string, unknown> = {};
  for (const p of planPrompts(t, b, own)) {
    try {
      const { data } = await chatJson(p.system, p.user, 6000);
      Object.assign(merged, data as object);
    } catch (e) {
      console.warn(`[plan ${p.key}] AI failed:`, (e as Error).message);
    }
  }
  const ai = normalizePlan(merged, base);
  // Fill any section the model skipped from the rule-based plan.
  return {
    ...base,
    executiveSummary: ai.executiveSummary || fallback.executiveSummary,
    positioning: ai.positioning.statement ? ai.positioning : fallback.positioning,
    icp: ai.icp.primary ? ai.icp : fallback.icp,
    strategies: ai.strategies.length ? ai.strategies : fallback.strategies,
    channelPlan: ai.channelPlan.length ? ai.channelPlan : fallback.channelPlan,
    executionPlan: ai.executionPlan.length ? ai.executionPlan : fallback.executionPlan,
    contentPlan: ai.contentPlan.calendar.length ? ai.contentPlan : fallback.contentPlan,
    seoPlan: ai.seoPlan.keywords.length ? ai.seoPlan : fallback.seoPlan,
    adsPlan: ai.adsPlan.angles.length ? ai.adsPlan : fallback.adsPlan,
    emailPlan: ai.emailPlan.sequence.length ? ai.emailPlan : fallback.emailPlan,
    swipeFile: ai.swipeFile.length ? ai.swipeFile : fallback.swipeFile,
    gapsToExploit: ai.gapsToExploit.length ? ai.gapsToExploit : fallback.gapsToExploit,
    kpis: ai.kpis.length ? ai.kpis : fallback.kpis,
    risks: ai.risks.length ? ai.risks : fallback.risks,
  };
}

export async function analyze(input: { competitorUrl: string; tier: "free" | "pro"; brand?: BrandInput }): Promise<Report> {
  const ownP = input.tier === "pro" && input.brand?.domain
    ? crawlSite(input.brand.domain, { deep: false }).catch(() => null)
    : Promise.resolve(null);
  const [competitor, own] = await Promise.all([crawlSite(input.competitorUrl), ownP]);
  const teardown = await buildTeardown(competitor);
  if (input.tier === "free" || !input.brand) return { tier: "free", teardown };
  const plan = await buildPlan(teardown, input.brand, own);
  return { tier: "pro", teardown, plan };
}
