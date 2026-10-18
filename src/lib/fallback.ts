import type { BrandInput } from "./prompts";
import type { CompetitorTeardown, ProPlan, SiteSignals } from "./types";

// Rule-based engine used when no AI key is set or every provider fails. It only
// states what the crawler observed plus clearly labelled, generic inferences, so
// the report is thinner than the AI version but never fabricated.

const has = (s: SiteSignals, name: string) => s.tech.some((t) => t.name === name);
const hasCat = (s: SiteSignals, cat: string) => s.tech.some((t) => t.category === cat);
const social = (s: SiteSignals, p: string) => s.socials.find((x) => x.platform === p);

function brandFrom(s: SiteSignals): string {
  const t = s.ogTitle || s.home.title || s.domain;
  return t.split(/[|\-:•·–—]/)[0].trim() || s.domain;
}

function topSection(s: SiteSignals, re: RegExp) {
  return s.sitemap.sections.find((x) => re.test(x.path));
}

export function ruleTeardown(s: SiteSignals): Omit<CompetitorTeardown, "competitor" | "url" | "generatedAt" | "engine"> {
  const blog = topSection(s, /blog|resources|articles|insights|news|guides|learn/);
  const adPixels = s.tech.filter((t) => t.category === "ads").map((t) => t.name);
  const esp = s.tech.filter((t) => t.category === "crm/email").map((t) => t.name);
  const headline = s.home.h1[0] || s.home.title;
  const sub = s.home.metaDescription || s.ogDescription;
  const primaryCta = s.home.ctas[0] || "Not detected";

  const channels: CompetitorTeardown["channels"] = [];
  channels.push({
    channel: "SEO",
    status: s.sitemap.urlCount > 50 ? "active" : s.sitemap.found ? "likely" : "unknown",
    evidence: s.sitemap.found
      ? `Sitemap lists ${s.sitemap.urlCount} URLs across ${s.sitemap.sections.length} sections${s.sitemap.programmatic.length ? `, including programmatic patterns ${s.sitemap.programmatic.map((p) => `${p.pattern} (${p.count})`).join(", ")}` : ""}.`
      : "No sitemap found.",
    role: "Cold traffic on problem and solution search terms.",
  });
  channels.push({
    channel: "Content/Blog",
    status: blog ? "active" : s.blogPage ? "likely" : "absent",
    evidence: blog ? `${blog.count} URLs under ${blog.path}. ${s.sitemap.updatedLast90Days} URLs updated in the last 90 days.` : s.blogPage ? `Blog page found at ${s.blogPage.url}.` : "No blog section detected.",
    role: "Feeds SEO and email capture.",
  });
  channels.push({
    channel: "Email",
    status: esp.length || s.emailCapture ? "active" : "unknown",
    evidence: esp.length ? `Email/CRM tools detected: ${esp.join(", ")}.` : s.emailCapture ? "Email capture form on homepage." : "No email capture seen on homepage.",
    role: "Warm nurture from visitor to customer.",
  });
  channels.push({
    channel: "Paid ads",
    status: adPixels.length ? "likely" : "unknown",
    evidence: adPixels.length ? `Retargeting/ads pixels installed: ${adPixels.join(", ")}. Pixels show intent to run ads, not spend. Check the public ad libraries to confirm.` : "No ad pixels detected in page source.",
    role: "Retargeting warm visitors, possibly prospecting cold audiences.",
  });
  for (const p of ["LinkedIn", "X / Twitter", "Instagram", "YouTube", "TikTok", "Facebook", "Podcast", "Discord"]) {
    const found = social(s, p);
    channels.push({
      channel: p,
      status: found ? "likely" : "unknown",
      evidence: found ? `Linked from site: ${found.url}` : "Not linked from homepage.",
      role: found ? "Brand presence; engagement not measured by this crawl." : "",
    });
  }
  if (has(s, "Affiliate program")) channels.push({ channel: "Affiliate/Partners", status: "active", evidence: "Affiliate tracking script detected.", role: "Paid-on-performance distribution." });

  const formats = [
    blog && "Blog articles",
    s.leadMagnets.includes("Webinar") && "Webinars",
    s.leadMagnets.includes("Templates") && "Templates",
    s.leadMagnets.includes("Free tool / calculator") && "Free tools",
    social(s, "YouTube") && "Video",
    social(s, "Podcast") && "Podcast",
    s.proofSignals.includes("Case studies") && "Case studies",
  ].filter(Boolean) as string[];

  const whatWorks: CompetitorTeardown["whatWorks"] = [];
  for (const p of s.sitemap.programmatic.slice(0, 2)) {
    whatWorks.push({
      tactic: `Programmatic SEO pages on the ${p.pattern} pattern`,
      evidence: `${p.count} URLs in sitemap (${s.fetchedAt.slice(0, 10)}).`,
      whyItWorks: "One template captures many long-tail, high-intent searches at low marginal cost.",
      transferable: "modified",
      costToCopy: "20 to 60 hours for a template plus a data source",
    });
  }
  if (s.leadMagnets.length)
    whatWorks.push({
      tactic: `Lead magnet as the entry offer (${s.leadMagnets.slice(0, 3).join(", ")})`,
      evidence: "Linked from homepage.",
      whyItWorks: "Lowers the first commitment and builds a list they can sell to repeatedly.",
      transferable: "yes",
      costToCopy: "8 to 20 hours",
    });
  if (s.pricing.freeTrial || s.pricing.freePlan)
    whatWorks.push({
      tactic: s.pricing.freePlan ? "Free plan as acquisition" : "Free trial as the main conversion step",
      evidence: "Stated on homepage or pricing page.",
      whyItWorks: "Lets the product do the selling and reduces perceived risk.",
      transferable: "modified",
      costToCopy: "Depends on product cost to serve",
    });
  if (s.proofSignals.length)
    whatWorks.push({
      tactic: "Social proof above the fold",
      evidence: s.proofSignals.join(", "),
      whyItWorks: "Answers 'does this work for people like me' before the visitor asks.",
      transferable: "yes",
      costToCopy: "2 to 6 hours once you have 3 customer quotes",
    });
  if (s.segments.length)
    whatWorks.push({
      tactic: "Dedicated segment pages (/for/, /solutions/)",
      evidence: s.segments.slice(0, 5).join(", "),
      whyItWorks: "Message match for each audience lifts conversion and ranks for '[category] for [segment]' searches.",
      transferable: "yes",
      costToCopy: "4 hours per page",
    });
  if (adPixels.length >= 2)
    whatWorks.push({
      tactic: "Multi-platform retargeting",
      evidence: adPixels.join(", "),
      whyItWorks: "Most visitors do not convert on visit one; retargeting brings warm visitors back cheaply.",
      transferable: "yes",
      costToCopy: "Low four figures a month to test, inferred",
    });

  const gaps: string[] = [];
  if (!s.llmsTxt) gaps.push("No llms.txt: they have not optimised for AI answer engines (ChatGPT, Perplexity). Early mover advantage is available.");
  if (!social(s, "YouTube")) gaps.push("No YouTube linked: video search for this category may be uncontested.");
  if (!social(s, "TikTok") && !social(s, "Instagram")) gaps.push("No short-form video presence linked.");
  if (!s.segments.length) gaps.push("No segment-specific pages: every audience gets the same message. Build pages per segment.");
  if (!s.proofSignals.includes("Case studies")) gaps.push("No case studies linked: proof is thin. Detailed customer stories with numbers are an easy edge.");
  if (!s.leadMagnets.includes("Free tool / calculator")) gaps.push("No free tool or calculator: a simple tool can win links and leads they are not competing for.");
  if (!s.pricing.pricePoints.length) gaps.push("Pricing not public: buyers who want transparency will choose a rival that shows prices.");
  if (!s.schemaTypes.length) gaps.push("No structured data detected: rich results in Google are open.");
  if (s.sitemap.found && s.sitemap.updatedLast90Days < 5) gaps.push("Few pages updated in 90 days: content looks stale; a consistent publishing cadence can overtake them.");

  return {
    summary: `${brandFrom(s)} leads with "${headline}"${sub ? ` and describes itself as: "${sub.replace(/\.$/, "")}"` : ""}. The primary call to action is "${primaryCta}". ${
      s.sitemap.found ? `Their sitemap lists ${s.sitemap.urlCount} URLs, which points to search as a meaningful channel.` : "No sitemap was found, so the size of their search footprint is unknown."
    } ${adPixels.length ? `Ad pixels (${adPixels.join(", ")}) suggest they pay for traffic or retargeting.` : "No ad pixels were detected."} This report was produced by the rule-based engine from observed signals only; add a free AI key for strategic interpretation.`,
    positioning: {
      oneLiner: headline || "Not detected",
      targetAudience: s.segments.length ? `Segments named on site: ${s.segments.slice(0, 5).join(", ")}` : "Not stated explicitly on the homepage.",
      awarenessStage: s.home.h1.join(" ").match(/\b(platform|software|app|tool|solution)\b/i) ? "Likely solution aware or product aware (headline names the category)." : "Likely problem aware (headline leads with the outcome or pain).",
      sophisticationStage: "Needs AI analysis or manual review.",
      coreOffer: s.pricingPage?.h1[0] || s.home.h2[0] || "Not detected",
      primaryCta,
    },
    audience: { segments: s.segments.slice(0, 8), painsAddressed: s.home.h2.slice(0, 6), objectionsHandled: s.home.h2.filter((h) => /\b(secure|easy|minutes|no code|cancel|free|guarantee|support|integrat)/i.test(h)).slice(0, 6) },
    channels,
    content: {
      pillars: (s.blogPage ? [...s.blogPage.h2] : []).slice(0, 6),
      formats,
      cadence: s.sitemap.found ? `${s.sitemap.updatedLast90Days} URLs added or updated in the last 90 days (from sitemap lastmod). Newest: ${s.sitemap.newestLastmod ?? "unknown"}.` : "Unknown (no sitemap).",
      ctaPattern: s.emailCapture ? "Email capture present: content likely works as a list-building engine." : s.home.ctas.some((c) => /demo|sales|contact/i.test(c)) ? "Demo/sales CTAs: content feeds the sales team." : "No clear content CTA detected.",
      hookStyle: "Needs AI analysis or manual review of 20 headlines.",
    },
    seo: {
      pageTypes: s.sitemap.sections.slice(0, 10).map((x) => `${x.path} (${x.count})`),
      programmatic: s.sitemap.programmatic.map((p) => `${p.pattern}: ${p.count} pages`),
      keywordThemes: [...s.home.h1, ...s.home.h2.slice(0, 5)],
      observations: [
        `Structured data: ${s.schemaTypes.length ? s.schemaTypes.join(", ") : "none detected"}.`,
        `llms.txt: ${s.llmsTxt ? "present" : "absent"}.`,
        s.robots.disallow.length ? `robots.txt hides: ${s.robots.disallow.slice(0, 6).join(", ")}.` : "robots.txt has no notable disallows.",
      ],
    },
    funnel: {
      entryOffer: s.pricing.freePlan ? "Free plan" : s.pricing.freeTrial ? "Free trial" : s.leadMagnets[0] ?? "Not detected",
      coreOffer: s.pricing.pricePoints.length ? `Paid plans from ${s.pricing.pricePoints.slice(0, 3).join(", ")}` : "Price not public",
      pricingModel: [s.pricing.pricePoints.length ? "Public tiered pricing" : "Quote based", s.pricing.annualDiscount && "annual discount", s.pricing.contactSales && "enterprise / contact sales"].filter(Boolean).join(", "),
      upgradeGate: "Read the pricing table: whatever is only in the paid tier is what they believe people pay for.",
      steps: [s.leadMagnets[0] ? `Visitor takes ${s.leadMagnets[0]}` : "Visitor lands on homepage", `Clicks "${primaryCta}"`, s.emailCapture ? "Enters email, gets nurtured" : "Signs up or contacts", s.pricing.contactSales ? "Larger accounts routed to sales" : "Self-serve purchase"],
    },
    techStack: s.tech.map((t) => `${t.name} (${t.category})`),
    whatWorks,
    gaps,
    quickWins: [
      "Write one comparison page answering the objection their homepage avoids.",
      gaps[0] ?? "Publish one in-depth guide on their highest-traffic topic with better original data.",
      "Collect three customer quotes with numbers and put them above the fold.",
      "Set up a 5-email welcome sequence before buying any traffic.",
    ],
  };
}

export function rulePlan(t: CompetitorTeardown, b: BrandInput, own: SiteSignals | null): Omit<ProPlan, "brandName" | "domain"> {
  const brand = b.brandName;
  const niche = b.niche || own?.home.h1[0] || "your category";
  const aud = b.audience || t.positioning.targetAudience || "your best-fit customers";
  const comp = t.competitor;
  const themes = (t.seo.keywordThemes.length ? t.seo.keywordThemes : [niche]).slice(0, 4);
  const pillars = [
    { name: "Problem education", purpose: "Rank for problem-aware searches and earn trust (TOFU).", topics: [`What is ${niche}? A plain guide`, `${niche}: 7 mistakes beginners make`, `How much does ${niche} cost in 2026?`, `${niche} checklist for ${aud}`, `The real cost of ignoring ${niche}`, `${niche} glossary: 25 terms explained`] },
    { name: "Comparisons and alternatives", purpose: "Capture solution-aware buyers comparing options (MOFU).", topics: [`${comp} alternatives: honest comparison`, `${brand} vs ${comp}`, `Best ${niche} tools for ${aud}`, `How to choose a ${niche} provider`, `${niche}: build vs buy`, `Questions to ask before buying ${niche}`] },
    { name: "Proof and results", purpose: "Convert product-aware visitors (BOFU).", topics: [`Case study: how a customer got a measurable result with ${brand}`, `Before and after: ${niche} teardown`, `Our numbers: what ${brand} delivered this quarter`, `Customer story: switching from ${comp}`, `ROI calculator walkthrough`, `FAQ: everything people ask before buying`] },
    { name: "Founder point of view", purpose: "Differentiate with opinions the competitor will not take.", topics: [`Why we built ${brand} differently`, `The ${niche} advice everyone repeats that is wrong`, `What we learned from 100 conversations with ${aud}`, `Our pricing, explained openly`, `What we will never do (and why)`, `The future of ${niche}`] },
  ];
  const calendar = Array.from({ length: 12 }, (_, i) => {
    const p = pillars[i % 4];
    return { week: i + 1, title: p.topics[Math.floor(i / 4)], format: ["blog", "carousel", "case study", "video"][i % 4], channel: ["Blog + LinkedIn", "LinkedIn", "Blog + Email", "YouTube + Shorts"][i % 4], funnelStage: ["TOFU", "MOFU", "BOFU", "TOFU"][i % 4], keyword: themes[i % themes.length].toLowerCase().slice(0, 80) };
  });
  return {
    executiveSummary: `${brand} will compete with ${comp} by borrowing the mechanisms that visibly work for them (${t.whatWorks.slice(0, 2).map((w) => w.tactic.toLowerCase()).join("; ") || "search content and a low-friction entry offer"}) and by owning the gaps they leave open (${t.gaps.slice(0, 2).join(" ") || "segments and formats they ignore"}). We start with the cheapest high-confidence channels: search content and email, then add one social channel. We do not copy anything that depends on their budget or brand. This plan was produced by the rule-based engine; add a free AI key for a fully tailored version.`,
    positioning: {
      statement: `For ${aud} who need ${niche} without the trade-offs of ${comp}, ${brand} is the focused alternative that ${b.goal ? `helps you ${b.goal}` : "delivers results faster and more transparently"}.`,
      differentiators: ["Transparent pricing and process", `Built specifically for ${aud}`, "Faster time to first result", "Founder-led, opinionated content"],
      messagingPillars: ["Clarity over hype", "Proof with real numbers", "Speed to value", "Specialist for one audience"],
      taglines: [`${niche}, made simple for ${aud}.`, `The honest ${niche} partner.`, `Results you can measure in 30 days.`],
    },
    icp: {
      primary: aud,
      secondary: t.audience.segments[0] || "Adjacent segment the competitor targets but under-serves",
      pains: t.audience.painsAddressed.slice(0, 5).length ? t.audience.painsAddressed.slice(0, 5) : ["Wasted time", "Unclear results", "High cost"],
      triggers: ["New budget cycle or funding", "A failed attempt with a competitor", "A new hire tasked with this problem", "A visible drop in results"],
      whereTheyGather: ["Relevant subreddits (search Reddit for your category, sort by top)", "Niche LinkedIn creators your buyers follow", "Industry newsletters (check who the competitor sponsors)", "Podcasts in your category", "Facebook and Slack groups for your audience"],
    },
    strategies: [
      { name: "Search moat", objective: "Own problem and comparison searches", borrowedMechanism: t.whatWorks[0]?.tactic || "Search-led content engine", ourTwist: "Narrower audience, original data, faster updates", whyItWillWork: "Search compounds and costs only time." },
      { name: "List first", objective: "Turn visitors into subscribers", borrowedMechanism: "Lead magnet as entry offer", ourTwist: "A free tool or checklist they do not offer", whyItWillWork: "Owned audience is cheaper than rented attention." },
      { name: "Proof engine", objective: "Lift conversion rate", borrowedMechanism: "Social proof near CTAs", ourTwist: "Case studies with specific numbers", whyItWillWork: "Specific proof beats generic claims at every awareness stage." },
      { name: "Own the gap", objective: "Win where they are absent", borrowedMechanism: "n/a: this is a blind spot", ourTwist: t.gaps[0] || "Short-form video", whyItWillWork: "A blind spot is cheaper to own than a strength is to attack." },
    ],
    channelPlan: [
      { channel: "SEO + blog", priority: "P1", goal: "Organic traffic on problem and comparison terms", tactics: ["2 articles a week from the calendar", "1 comparison page a month", "Internal links to money pages"], kpi: "Organic sessions, keyword positions", effort: "8 to 10 h/week" },
      { channel: "Email", priority: "P1", goal: "Capture and nurture", tactics: ["Lead magnet", "6-email welcome sequence", "Weekly newsletter"], kpi: "Opt-in rate, reply rate", effort: "3 h/week" },
      { channel: "LinkedIn (founder)", priority: "P2", goal: "Authority and warm traffic", tactics: ["3 posts a week cut from blog pillars", "Comment on 10 buyer posts a day"], kpi: "Profile visits, DMs", effort: "4 h/week" },
      { channel: "Paid retargeting", priority: "P3", goal: "Bring back warm visitors", tactics: ["Retarget blog readers with lead magnet", "Only after organic proves the message"], kpi: "Cost per lead", effort: "Small test budget, inferred" },
    ],
    gapsToExploit: t.gaps.slice(0, 6),
    risks: [`${comp} may have brand, budget and domain authority we lack; SEO takes 3 to 6 months to compound.`, "A rule-based plan is generic; validate topics with real keyword data.", "Spreading across too many channels. Hold to two new channels in 90 days."],
    executionPlan: [
      { phase: "Days 1-30", focus: "Foundations and first content", tasks: [
        { task: "Rewrite homepage headline and above-the-fold proof", hours: "6", metric: "Homepage conversion rate", killRule: "Revert if conversion drops after 500 visits" },
        { task: "Build lead magnet and 6-email welcome sequence", hours: "12", metric: "Opt-in rate above 2%", killRule: "Swap the magnet if under 1% after 300 visitors" },
        { task: "Publish 8 articles from the calendar", hours: "24", metric: "Indexed pages, impressions", killRule: "Re-target keywords with zero impressions after 45 days" },
        { task: "Set up analytics, Search Console, UTM conventions", hours: "3", metric: "Tracking live", killRule: "n/a" },
      ] },
      { phase: "Days 31-60", focus: "Distribution and proof", tasks: [
        { task: "Founder LinkedIn: 3 posts a week cut from articles", hours: "16", metric: "Engagement rate 2% plus, profile visits", killRule: "Change format if under 1% after 12 posts" },
        { task: "Publish 2 case studies with numbers", hours: "10", metric: "Case study page conversions", killRule: "n/a" },
        { task: `Publish ${brand} vs ${comp} and alternatives pages`, hours: "8", metric: "Comparison keyword rankings", killRule: "Rewrite if no impressions in 60 days" },
      ] },
      { phase: "Days 61-90", focus: "Double down and test paid", tasks: [
        { task: "Update top 5 articles with new data", hours: "8", metric: "Position change", killRule: "n/a" },
        { task: "Launch retargeting test with best organic post as creative", hours: "6", metric: "Cost per lead", killRule: "Stop if CPL is 2x the target after 2 weeks" },
        { task: "Build one free tool or template the competitor lacks", hours: "20", metric: "Backlinks, signups", killRule: "Stop promoting if under 50 uses in 30 days" },
      ] },
    ],
    contentPlan: {
      pillars,
      calendar,
      repurposingChain: ["Pillar article (2,000 words)", "3 LinkedIn text posts from its sections", "1 carousel of the framework", "1 newsletter issue", "1 short video of the main point", "2 quote graphics", "1 guest post on the same thesis", "Best line becomes ad creative"],
      template: ["1 Hook: a cost or number the reader recognises (40 to 70 words)", "2 Credential: why we can say this, one line", "3 Counter-position: what most people believe, and why it is wrong", "4 Mechanism: 3 to 5 named steps, H2 each", "5 Worked example with real numbers", "6 The objection, answered", "7 Checklist or template download", "8 CTA to lead magnet"],
    },
    seoPlan: {
      keywords: [
        ...themes.map((k) => ({ keyword: k.toLowerCase().slice(0, 80), intent: "informational", pageType: "Pillar guide" })),
        { keyword: `${comp.toLowerCase()} alternatives`, intent: "commercial", pageType: "Alternatives page" },
        { keyword: `${brand.toLowerCase()} vs ${comp.toLowerCase()}`, intent: "commercial", pageType: "Comparison page" },
        { keyword: `best ${niche.toLowerCase()} for ${aud.toLowerCase()}`.slice(0, 90), intent: "commercial", pageType: "Listicle" },
        { keyword: `${niche.toLowerCase()} pricing`, intent: "transactional", pageType: "Pricing page" },
        { keyword: `${niche.toLowerCase()} template`, intent: "informational", pageType: "Template download" },
      ],
      pageTypesToBuild: ["Pillar guides", "Comparison and alternatives pages", "Segment pages (/for/{audience})", "Glossary", "Templates"],
      programmaticIdea: t.seo.programmatic[0] ? `Mirror their ${t.seo.programmatic[0]} pattern with your own data and a narrower audience.` : `/for/{industry} pages: one template, one page per industry you serve, each with a specific example.`,
    },
    adsPlan: {
      angles: [
        { angle: "Time saver", hook: `Stop losing hours on ${niche}.`, offer: "Free checklist", format: "Single image" },
        { angle: "Risk reducer", hook: `The ${niche} mistake that costs ${aud} the most.`, offer: "Free audit", format: "Short video" },
        { angle: "Switcher", hook: `Thinking of leaving ${comp}? Read this first.`, offer: "Comparison guide", format: "Carousel" },
        { angle: "Proof", hook: "How one customer got a measurable result in 30 days.", offer: "Case study", format: "Document ad" },
      ],
      budgetGuidance: "Guidance only: start with a small retargeting test after organic content shows which message works. Ask the user before bidding on competitor brand terms.",
    },
    emailPlan: {
      leadMagnet: `The ${niche} checklist for ${aud}`,
      sequence: [
        { day: 0, subject: "Your checklist (and one thing to do today)", goal: "Deliver value, set expectations" },
        { day: 1, subject: `The biggest ${niche} mistake we see`, goal: "Problem education" },
        { day: 3, subject: "How a customer fixed this in 30 days", goal: "Proof" },
        { day: 5, subject: `${comp} or ${brand}? An honest answer`, goal: "Handle the comparison objection" },
        { day: 7, subject: "A quick question", goal: "Get replies, learn objections" },
        { day: 10, subject: "Ready when you are", goal: "Direct offer" },
      ],
    },
    swipeFile: [
      { mechanism: "Number-led hook", whyItWorks: "Specific numbers signal credibility and stop the scroll.", blankVersion: "[Number] [audience] [did/lost thing]. Here is what [result].", yourVersion: `We studied ${aud}: here is what separates good ${niche} from bad.` },
      { mechanism: "Proof directly under the CTA", whyItWorks: "Answers the risk question at the moment of decision.", blankVersion: "[CTA button] + [count] [customers] + [one quote with a number]", yourVersion: `Start free + quote from a ${brand} customer with their result.` },
      { mechanism: "Comparison page that admits a weakness", whyItWorks: "Honesty raises trust for every other claim.", blankVersion: "[Us] vs [them]: where they win, where we win, who should pick which.", yourVersion: `${brand} vs ${comp}: an honest comparison.` },
    ],
    kpis: [
      { metric: "Organic sessions", target30: "Baseline", target90: "+50% on baseline" },
      { metric: "Email subscribers", target30: "100", target90: "500" },
      { metric: "Opt-in rate", target30: "2%", target90: "4%" },
      { metric: "Articles published", target30: "8", target90: "24" },
      { metric: "Demo/trial conversions from content", target30: "Baseline", target90: "2x baseline" },
    ],
  };
}

export { brandFrom };
