import type { BrandStage, CompareRow, CompetitorTeardown, SiteSignals } from "./types";

// Prompts encode the copycat-marketing method: copy the mechanism, never the material;
// separate observation from inference; count, do not impress; be honest about what
// transfers; never present a guess as a number; no em dashes.

const METHOD = `You are a senior growth marketer who reverse engineers competitors' marketing.
Rules you always follow:
- Copy the mechanism, never the material. Funnel structures, formats, cadence, hook shapes, pricing logic and channel mixes are fair game. Their text, images, brand and customer data are not.
- Separate observation from inference. When something is inferred, say "likely" or "inferred". Never invent numbers (traffic, spend, revenue). If unknown, say unknown.
- Count, do not impress. Prefer "sitemap shows 412 /integrations/ pages" over "lots of SEO pages".
- Be honest about what transfers. Much of what a funded competitor does depends on budget, brand or team.
- Use Schwartz awareness stages (unaware, problem aware, solution aware, product aware, most aware) and market sophistication stages 1 to 5.
- Name concrete congregations (specific subreddits, newsletters, podcasts, communities) where possible, marked as suggestions.
- Plain, direct English. No em dashes. No hype words like "revolutionary" or "game-changing".
- Reply with a single valid JSON object only, matching the schema exactly.`;

function trimList(xs: string[], n: number) {
  return xs.slice(0, n);
}

/** Compact, token-cheap digest of observed signals for the model. */
export function digest(s: SiteSignals, label = "COMPETITOR"): string {
  const d = {
    site: s.finalUrl,
    fetchedAt: s.fetchedAt.slice(0, 10),
    title: s.home.title,
    metaDescription: s.home.metaDescription,
    ogDescription: s.ogDescription,
    h1: s.home.h1,
    h2: trimList(s.home.h2, 15),
    ctas: trimList(s.home.ctas, 12),
    nav: trimList(s.navLinks.map((l) => l.text), 25),
    homepageTextSample: s.home.textSample.slice(0, 1800),
    wordCount: s.home.wordCount,
    socials: s.socials.map((x) => x.platform),
    tech: s.tech.map((t) => `${t.name} (${t.category})`),
    schemaTypes: s.schemaTypes,
    segmentPages: s.segments,
    leadMagnets: s.leadMagnets,
    proofSignals: s.proofSignals,
    utmCampaigns: s.utmCampaigns,
    emailCapture: s.emailCapture,
    pricing: { ...s.pricing },
    pricingPage: s.pricingPage
      ? { h1: s.pricingPage.h1, h2: trimList(s.pricingPage.h2, 10), ctas: trimList(s.pricingPage.ctas, 8), text: s.pricingPage.textSample.slice(0, 900) }
      : null,
    blogPage: s.blogPage ? { title: s.blogPage.title, headings: trimList([...s.blogPage.h1, ...s.blogPage.h2], 20) } : null,
    sitemap: {
      found: s.sitemap.found,
      urlCount: s.sitemap.urlCount,
      sections: s.sitemap.sections,
      programmaticPatterns: s.sitemap.programmatic,
      updatedLast90Days: s.sitemap.updatedLast90Days,
      newestLastmod: s.sitemap.newestLastmod,
    },
    robotsDisallow: trimList(s.robots.disallow, 10),
    llmsTxt: s.llmsTxt,
    crawlerNotes: s.notes,
  };
  return `${label} SIGNALS (observed by our crawler, JSON):\n${JSON.stringify(d)}`;
}

const TEARDOWN_SCHEMA = `{
 "summary": "4-6 sentences: who they sell to, how they get attention, how they convert, the one thing that matters most",
 "positioning": {"oneLiner": "their positioning in one plain sentence", "targetAudience": "", "awarenessStage": "stage + why", "sophisticationStage": "1-5 + why", "coreOffer": "", "primaryCta": ""},
 "audience": {"segments": [""], "painsAddressed": [""], "objectionsHandled": [""]},
 "channels": [{"channel": "SEO|Content/Blog|Email|Paid search|Paid social|LinkedIn|X|Instagram|TikTok|YouTube|Podcast|Community|Affiliate/Partners|PR|Product-led", "status": "active|likely|absent|unknown", "evidence": "what we observed", "role": "cold|warm|hot traffic and what it does"}],
 "content": {"pillars": [""], "formats": [""], "cadence": "from sitemap dates if available else unknown", "ctaPattern": "what content CTAs ask for and what that reveals", "hookStyle": ""},
 "seo": {"pageTypes": [""], "programmatic": ["pattern and count"], "keywordThemes": [""], "observations": [""]},
 "funnel": {"entryOffer": "", "coreOffer": "", "pricingModel": "", "upgradeGate": "what is behind the paywall in one sentence", "steps": ["step 1", "step 2"]},
 "techStack": [""],
 "whatWorks": [{"tactic": "the mechanism, not the example", "evidence": "", "whyItWorks": "", "transferable": "yes|no|modified", "costToCopy": "hours or budget band"}],
 "gaps": ["blind spots, missing channels, unanswered objections, funnel weak points"],
 "quickWins": ["3-5 things a smaller rival could do this month to compete"]
}`;

export function teardownPrompt(s: SiteSignals): { system: string; user: string } {
  return {
    system: METHOD,
    user: `Reverse engineer this competitor's marketing from the observed signals below.
Produce 6-12 channels, 5-8 whatWorks entries, 5-8 gaps.

${digest(s)}

Return JSON with exactly this schema:
${TEARDOWN_SCHEMA}`,
  };
}

function teardownBrief(t: CompetitorTeardown): string {
  return JSON.stringify({
    competitor: t.competitor,
    summary: t.summary,
    positioning: t.positioning,
    audience: t.audience,
    activeChannels: t.channels.filter((c) => c.status === "active" || c.status === "likely").map((c) => `${c.channel}: ${c.evidence}`),
    content: t.content,
    seo: t.seo,
    funnel: t.funnel,
    whatWorks: t.whatWorks.map((w) => `${w.tactic} (${w.transferable})`),
    gaps: t.gaps,
  });
}

export interface BrandInput {
  stage: BrandStage;
  /** May be empty for a fresh start; the plan then suggests names. */
  brandName: string;
  /** Empty for a fresh start. */
  domain: string;
  niche?: string;
  audience?: string;
  location?: string;
  goal?: string;
  budget?: string;
}

function brandBlock(b: BrandInput, own: SiteSignals | null): string {
  if (b.stage === "new") {
    return `OUR BRAND: a FRESH START. No website and no marketing yet${b.brandName ? `; working name "${b.brandName}"` : "; no name yet"}.
Inputs: ${JSON.stringify({ sells: b.niche, audience: b.audience, market: b.location, goal: b.goal, monthlyBudget: b.budget })}
Plan for launching from zero: foundations first (site, tracking, email capture, one channel), then growth. Do not assume an existing audience, traffic or content.`;
  }
  return `OUR BRAND: an EXISTING business with a website. ${JSON.stringify({ brandName: b.brandName, domain: b.domain, sells: b.niche, audience: b.audience, goal: b.goal, monthlyBudget: b.budget })}
${own ? digest(own, "OUR SITE") : "OUR SITE: could not be read, rely on the brand inputs."}
Plan for growing what exists: fix the biggest gaps against the competitor first, reuse assets we already have.`;
}

const PLAN_A_SCHEMA = `{
 "executiveSummary": "5-7 sentences: the plan in plain words, the bet we are making, and what we are NOT copying and why",
 "positioning": {"statement": "For [audience] who [pain], [brand] is the [category] that [benefit], unlike [competitor] which [their weakness]", "differentiators": [""], "messagingPillars": [""], "taglines": ["3 original options"]},
 "icp": {"primary": "", "secondary": "", "pains": [""], "triggers": ["events that make them buy now"], "whereTheyGather": ["specific subreddits, newsletters, podcasts, communities, events"]},
 "strategies": [{"name": "", "objective": "", "borrowedMechanism": "the competitor mechanism we borrow", "ourTwist": "how we make it ours", "whyItWillWork": ""}],
 "channelPlan": [{"channel": "", "priority": "P1|P2|P3", "goal": "", "tactics": [""], "kpi": "", "effort": "hours per week or budget band"}],
 "gapsToExploit": ["competitor blind spots we will own"],
 "risks": ["honest risks, including engines the competitor has that we lack and how long they take to build"]
}`;

const PLAN_B_SCHEMA = `{
 "executionPlan": [{"phase": "Days 1-30|Days 31-60|Days 61-90", "focus": "", "tasks": [{"task": "", "hours": "", "metric": "", "killRule": "when we stop doing this"}]}],
 "contentPlan": {
   "pillars": [{"name": "", "purpose": "", "topics": ["6 specific article or video titles"]}],
   "calendar": [{"week": 1, "title": "specific title", "format": "blog|video|carousel|newsletter|thread|case study|tool|template", "channel": "", "funnelStage": "TOFU|MOFU|BOFU", "keyword": "target search phrase"}],
   "repurposingChain": ["how one pillar asset becomes 8+ derivatives, step by step"],
   "template": ["the article skeleton as section types, e.g. 1 Hook: a cost the reader recognises (40-70 words)"]
 },
 "kpis": [{"metric": "", "target30": "", "target90": ""}]
}`;

const PLAN_C_SCHEMA = `{
 "seoPlan": {"keywords": [{"keyword": "", "intent": "informational|commercial|transactional|navigational", "pageType": ""}], "pageTypesToBuild": [""], "programmaticIdea": "a /pattern/{slug} idea with the data source"},
 "adsPlan": {"angles": [{"angle": "time saver|cost cut|status|risk reducer|...", "hook": "first line of the ad", "offer": "", "format": ""}], "budgetGuidance": "a band and test structure, marked as guidance"},
 "emailPlan": {"leadMagnet": "", "sequence": [{"day": 0, "subject": "", "goal": ""}]},
 "swipeFile": [{"mechanism": "one sentence", "whyItWorks": "", "blankVersion": "structure with every specific removed", "yourVersion": "written for our brand"}]
}`;

const PLAN_D_EXISTING_SCHEMA = `{
 "currentState": {"summary": "4-6 sentences: where our brand stands today against the competitor, from the comparison", "strengths": ["what we already do as well or better"], "priorities": ["the 3-5 gaps to close first, in order, each with why"]}
}`;

const PLAN_D_NEW_SCHEMA = `{
 "launchKit": {
   "nameIdeas": ["5 original brand name ideas with a 3-6 word reason each; empty array if we already have a name"],
   "websitePages": [{"page": "", "purpose": "why this page exists and what it must convert"}],
   "homepageOutline": ["section-by-section homepage outline, in order, borrowing the competitor's argument order where it works"],
   "launchChecklist": [{"task": "concrete setup task", "why": ""}]
 }
}`;

export function planPrompts(t: CompetitorTeardown, b: BrandInput, own: SiteSignals | null, compare: CompareRow[] = []) {
  const ctx = `COMPETITOR TEARDOWN (already analysed):\n${teardownBrief(t)}\n\n${brandBlock(b, own)}`;
  const d =
    b.stage === "new"
      ? {
          key: "D",
          system: METHOD,
          user: `We are launching from zero. Write the launch kit: ${b.brandName ? "no name ideas (we have a name)" : "5 name ideas"}, 5-7 website pages to build first, a 8-10 section homepage outline, and a 10-14 item launch checklist (domain, site, analytics, pixels, Google Business Profile if local, social handles, email capture, first lead magnet, first content). Keep it doable by one person in 30 days.

${ctx}

Return JSON with exactly this schema:
${PLAN_D_NEW_SCHEMA}`,
        }
      : {
          key: "D",
          system: METHOD,
          user: `Read this observed side-by-side of OUR site vs the COMPETITOR and write where we stand today. Only use what the comparison shows.
COMPARISON (observed, JSON): ${JSON.stringify(compare)}

${ctx}

Return JSON with exactly this schema:
${PLAN_D_EXISTING_SCHEMA}`,
        };
  return [
    d,
    {
      key: "A",
      system: METHOD,
      user: `Build our brand's marketing strategy from the competitor teardown. Never more than two NEW channels in the first 90 days. Include at least one thing the competitor does badly that we will do well.
Produce 4-6 strategies, 5-8 channelPlan rows, 5-8 gapsToExploit.

${ctx}

Return JSON with exactly this schema:
${PLAN_A_SCHEMA}`,
    },
    {
      key: "B",
      system: METHOD,
      user: `Build our brand's 30/60/90 day execution plan and content plan. Cheapest high-confidence items first. Every task has hours, a metric and a kill rule.
Produce 3 phases with 4-6 tasks each, 4 content pillars, a 12-week calendar (12 rows, one per week), 6-8 KPIs.

${ctx}

Return JSON with exactly this schema:
${PLAN_B_SCHEMA}`,
    },
    {
      key: "C",
      system: METHOD,
      user: `Build our brand's SEO, ads and email plan plus a swipe file of borrowed mechanisms. Swipe entries must pass the test: once specifics are stripped, the blank version is a generic structure, not recognisably theirs.
Produce 15 keywords, 5 ad angles, a 6-email sequence, 6 swipe entries.

${ctx}

Return JSON with exactly this schema:
${PLAN_C_SCHEMA}`,
    },
  ];
}
