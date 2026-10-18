// Observations collected from a site. Everything here is observed, never inferred;
// inference happens in the analysis step and is labelled there.

export interface LinkRef {
  text: string;
  href: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  ctas: string[];
  textSample: string;
  wordCount: number;
  pricePoints: string[];
}

export interface SitemapSummary {
  found: boolean;
  urlCount: number;
  sections: { path: string; count: number }[];
  programmatic: { pattern: string; count: number }[];
  /** URLs with a lastmod in the last 90 days. */
  updatedLast90Days: number;
  newestLastmod: string | null;
  sampleUrls: string[];
}

export interface SiteSignals {
  inputUrl: string;
  finalUrl: string;
  domain: string;
  fetchedAt: string;
  reachable: boolean;
  home: PageSnapshot;
  lang: string;
  ogTitle: string;
  ogDescription: string;
  navLinks: LinkRef[];
  socials: { platform: string; url: string }[];
  tech: { name: string; category: string }[];
  schemaTypes: string[];
  segments: string[];
  leadMagnets: string[];
  proofSignals: string[];
  utmCampaigns: string[];
  emailCapture: boolean;
  pricing: {
    pageUrl: string | null;
    pricePoints: string[];
    freeTrial: boolean;
    freePlan: boolean;
    contactSales: boolean;
    annualDiscount: boolean;
    moneyBackGuarantee: boolean;
  };
  pricingPage: PageSnapshot | null;
  blogPage: PageSnapshot | null;
  robots: { found: boolean; disallow: string[]; sitemaps: string[] };
  sitemap: SitemapSummary;
  llmsTxt: boolean;
  notes: string[];
}

export type Tier = "free" | "pro";

export interface Transferable {
  tactic: string;
  evidence: string;
  whyItWorks: string;
  transferable: "yes" | "no" | "modified";
  costToCopy: string;
}

export interface CompetitorTeardown {
  competitor: string;
  url: string;
  generatedAt: string;
  engine: string;
  summary: string;
  positioning: {
    oneLiner: string;
    targetAudience: string;
    awarenessStage: string;
    sophisticationStage: string;
    coreOffer: string;
    primaryCta: string;
  };
  audience: { segments: string[]; painsAddressed: string[]; objectionsHandled: string[] };
  channels: { channel: string; status: "active" | "likely" | "absent" | "unknown"; evidence: string; role: string }[];
  content: { pillars: string[]; formats: string[]; cadence: string; ctaPattern: string; hookStyle: string };
  seo: { pageTypes: string[]; programmatic: string[]; keywordThemes: string[]; observations: string[] };
  funnel: { entryOffer: string; coreOffer: string; pricingModel: string; upgradeGate: string; steps: string[] };
  techStack: string[];
  whatWorks: Transferable[];
  gaps: string[];
  quickWins: string[];
}

export interface ProPlan {
  brandName: string;
  domain: string;
  executiveSummary: string;
  positioning: { statement: string; differentiators: string[]; messagingPillars: string[]; taglines: string[] };
  icp: { primary: string; secondary: string; pains: string[]; triggers: string[]; whereTheyGather: string[] };
  strategies: { name: string; objective: string; borrowedMechanism: string; ourTwist: string; whyItWillWork: string }[];
  channelPlan: { channel: string; priority: "P1" | "P2" | "P3"; goal: string; tactics: string[]; kpi: string; effort: string }[];
  executionPlan: { phase: string; focus: string; tasks: { task: string; hours: string; metric: string; killRule: string }[] }[];
  contentPlan: {
    pillars: { name: string; purpose: string; topics: string[] }[];
    calendar: { week: number; title: string; format: string; channel: string; funnelStage: string; keyword: string }[];
    repurposingChain: string[];
    template: string[];
  };
  seoPlan: { keywords: { keyword: string; intent: string; pageType: string }[]; pageTypesToBuild: string[]; programmaticIdea: string };
  adsPlan: { angles: { angle: string; hook: string; offer: string; format: string }[]; budgetGuidance: string };
  emailPlan: { leadMagnet: string; sequence: { day: number; subject: string; goal: string }[] };
  swipeFile: { mechanism: string; whyItWorks: string; blankVersion: string; yourVersion: string }[];
  gapsToExploit: string[];
  kpis: { metric: string; target30: string; target90: string }[];
  risks: string[];
}

export interface Report {
  tier: Tier;
  teardown: CompetitorTeardown;
  plan?: ProPlan;
}
