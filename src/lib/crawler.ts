import * as cheerio from "cheerio";
import { normalizeUrl, safeFetch, tryFetch } from "./safeFetch";
import type { LinkRef, PageSnapshot, SitemapSummary, SiteSignals } from "./types";

// Builds the "footprint" phase of a teardown from public, unauthenticated pages:
// homepage, robots.txt, sitemap, llms.txt, plus the pricing and blog pages if linked.

const CTA_WORDS =
  /\b(start|try|get|book|request|sign ?up|join|download|subscribe|buy|shop|order|contact|talk|schedule|claim|create|demo|free|register|apply|explore|see|watch|learn)\b/i;

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/linkedin\.com/, "LinkedIn"],
  [/(twitter|x)\.com/, "X / Twitter"],
  [/instagram\.com/, "Instagram"],
  [/facebook\.com|fb\.com/, "Facebook"],
  [/youtube\.com|youtu\.be/, "YouTube"],
  [/tiktok\.com/, "TikTok"],
  [/pinterest\./, "Pinterest"],
  [/threads\.net/, "Threads"],
  [/discord\.(gg|com)/, "Discord"],
  [/reddit\.com/, "Reddit"],
  [/github\.com/, "GitHub"],
  [/medium\.com/, "Medium"],
  [/substack\.com/, "Substack"],
  [/podcasts\.apple\.com|open\.spotify\.com\/show/, "Podcast"],
  [/t\.me\//, "Telegram"],
  [/wa\.me|whatsapp\.com/, "WhatsApp"],
];

const TECH: [RegExp, string, string][] = [
  [/googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/, "Google Tag Manager", "analytics"],
  [/gtag\(|google-analytics\.com|G-[A-Z0-9]{6,}/, "Google Analytics", "analytics"],
  [/connect\.facebook\.net|fbq\(/, "Meta Pixel", "ads"],
  [/snap\.licdn\.com|_linkedin_partner_id/, "LinkedIn Insight Tag", "ads"],
  [/googleadservices\.com|AW-\d{6,}/, "Google Ads", "ads"],
  [/analytics\.tiktok\.com|ttq\./, "TikTok Pixel", "ads"],
  [/static\.ads-twitter\.com|twq\(/, "X Pixel", "ads"],
  [/bat\.bing\.com/, "Microsoft Ads", "ads"],
  [/redditstatic\.com\/ads|rdt\(/, "Reddit Pixel", "ads"],
  [/js\.hs-scripts\.com|hs-analytics|hubspot/i, "HubSpot", "crm/email"],
  [/klaviyo/i, "Klaviyo", "crm/email"],
  [/mailchimp|list-manage\.com/i, "Mailchimp", "crm/email"],
  [/convertkit|kit\.com\/forms/i, "Kit (ConvertKit)", "crm/email"],
  [/beehiiv/i, "beehiiv", "crm/email"],
  [/marketo|mktoForms/i, "Marketo", "crm/email"],
  [/pardot/i, "Pardot", "crm/email"],
  [/activecampaign/i, "ActiveCampaign", "crm/email"],
  [/customer\.io/i, "Customer.io", "crm/email"],
  [/intercom/i, "Intercom", "chat"],
  [/drift\.com|js\.driftt/i, "Drift", "chat"],
  [/crisp\.chat/i, "Crisp", "chat"],
  [/tawk\.to/i, "Tawk.to", "chat"],
  [/zendesk|zdassets/i, "Zendesk", "chat"],
  [/hotjar/i, "Hotjar", "cro"],
  [/clarity\.ms/i, "Microsoft Clarity", "cro"],
  [/fullstory/i, "FullStory", "cro"],
  [/optimizely/i, "Optimizely", "cro"],
  [/vwo\.com|visualwebsiteoptimizer/i, "VWO", "cro"],
  [/segment\.com\/analytics|cdn\.segment/i, "Segment", "analytics"],
  [/mixpanel/i, "Mixpanel", "analytics"],
  [/amplitude/i, "Amplitude", "analytics"],
  [/posthog/i, "PostHog", "analytics"],
  [/plausible\.io/i, "Plausible", "analytics"],
  [/cdn\.shopify\.com|Shopify\.theme/i, "Shopify", "cms"],
  [/wp-content|wp-includes/i, "WordPress", "cms"],
  [/webflow/i, "Webflow", "cms"],
  [/framerusercontent|framer\.com/i, "Framer", "cms"],
  [/squarespace/i, "Squarespace", "cms"],
  [/wix\.com|wixstatic/i, "Wix", "cms"],
  [/__NEXT_DATA__|\/_next\//, "Next.js", "cms"],
  [/ghost\.(org|io)|content\/images/i, "Ghost", "cms"],
  [/js\.stripe\.com/i, "Stripe", "payments"],
  [/paddle\.com/i, "Paddle", "payments"],
  [/lemonsqueezy/i, "Lemon Squeezy", "payments"],
  [/calendly/i, "Calendly", "sales"],
  [/chilipiper/i, "Chili Piper", "sales"],
  [/typeform/i, "Typeform", "forms"],
  [/rewardful|firstpromoter|partnerstack|impact\.com|refersion/i, "Affiliate program", "affiliate"],
  [/trustpilot/i, "Trustpilot widget", "proof"],
  [/g2\.com|g2crowd/i, "G2 badge", "proof"],
  [/yotpo|judge\.me|okendo|stamped\.io|loox/i, "Reviews app", "proof"],
];

const LEAD_MAGNETS: [RegExp, string][] = [
  [/\b(e-?book|guide|playbook|whitepaper|report)\b/i, "Guide / ebook / report"],
  [/\bwebinars?\b/i, "Webinar"],
  [/\btemplates?\b/i, "Templates"],
  [/\b(calculator|grader|checker|generator|analy[sz]er|free tool)\b/i, "Free tool / calculator"],
  [/\bnewsletter\b/i, "Newsletter"],
  [/\b(quiz|assessment)\b/i, "Quiz / assessment"],
  [/\b(course|academy|masterclass|bootcamp)\b/i, "Course / academy"],
  [/\b(free trial|try (it )?free|start free)\b/i, "Free trial"],
  [/\b(demo)\b/i, "Demo"],
  [/\b(community|slack group|discord)\b/i, "Community"],
  [/\b(\d+% off|discount code|first order)\b/i, "Discount"],
];

const PROGRAMMATIC_HINTS = [
  "integrations",
  "integration",
  "alternatives",
  "alternative",
  "vs",
  "compare",
  "templates",
  "template",
  "glossary",
  "locations",
  "cities",
  "tools",
  "examples",
  "apps",
  "for",
  "solutions",
  "industries",
  "use-cases",
  "customers",
  "case-studies",
  "learn",
  "guides",
  "docs",
  "help",
  "blog",
  "products",
  "collections",
];

function clean(s: string | undefined | null, max = 200): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function extractPricePoints(text: string): string[] {
  const re = /(?:[$€£₹]\s?\d{1,5}(?:[.,]\d{2})?(?:\s?(?:\/|per)\s?(?:month|mo|year|yr|user|seat))?)|(?:\d{1,5}(?:[.,]\d{2})?\s?(?:USD|EUR|GBP|INR)(?:\s?\/\s?(?:month|mo|year|yr))?)/gi;
  return uniq((text.match(re) ?? []).map((m) => m.replace(/\s+/g, " ").trim())).slice(0, 12);
}

export function snapshotPage(html: string, url: string): { page: PageSnapshot; $: cheerio.CheerioAPI } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const text = clean($("body").text(), 100_000);
  const ctas = uniq(
    $("a, button")
      .map((_, el) => clean($(el).text(), 60))
      .get()
      .filter((t) => t.length > 1 && t.length < 40 && CTA_WORDS.test(t)),
  ).slice(0, 20);
  const page: PageSnapshot = {
    url,
    title: clean($("title").first().text()),
    metaDescription: clean($('meta[name="description"]').attr("content"), 320),
    h1: uniq($("h1").map((_, el) => clean($(el).text(), 160)).get().filter(Boolean)).slice(0, 5),
    h2: uniq($("h2").map((_, el) => clean($(el).text(), 140)).get().filter(Boolean)).slice(0, 20),
    ctas,
    textSample: text.slice(0, 3000),
    wordCount: text ? text.split(" ").length : 0,
    pricePoints: extractPricePoints(text),
  };
  return { page, $ };
}

function parseRobots(txt: string) {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*(disallow|sitemap)\s*:\s*(\S+)/i);
    if (!m) continue;
    if (m[1].toLowerCase() === "disallow") disallow.push(m[2]);
    else sitemaps.push(m[2]);
  }
  return { disallow: uniq(disallow).slice(0, 30), sitemaps: uniq(sitemaps).slice(0, 10) };
}

function locs(xml: string): { loc: string; lastmod: string | null }[] {
  const out: { loc: string; lastmod: string | null }[] = [];
  const re = /<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < 20_000) {
    const loc = m[1].match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/i)?.[1];
    const lastmod = m[1].match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i)?.[1] ?? null;
    if (loc) out.push({ loc, lastmod });
  }
  return out;
}

export function summarizeSitemap(urls: { loc: string; lastmod: string | null }[], now = Date.now()): SitemapSummary {
  const sectionCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  let recent = 0;
  let newest: string | null = null;
  for (const { loc, lastmod } of urls) {
    let path: string;
    try {
      path = new URL(loc).pathname;
    } catch {
      continue;
    }
    const parts = path.split("/").filter(Boolean);
    // Skip a leading locale segment like /en/ or /en-us/.
    if (parts.length > 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0])) parts.shift();
    const section = parts.length ? `/${parts[0]}/` : "/";
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
    if (parts.length >= 2 && PROGRAMMATIC_HINTS.includes(parts[0].toLowerCase())) {
      const pat = `/${parts[0]}/{slug}`;
      patternCounts.set(pat, (patternCounts.get(pat) ?? 0) + 1);
    }
    if (lastmod) {
      const t = Date.parse(lastmod);
      if (!Number.isNaN(t)) {
        if (now - t < 90 * 864e5) recent++;
        if (!newest || t > Date.parse(newest)) newest = new Date(t).toISOString().slice(0, 10);
      }
    }
  }
  const sections = [...sectionCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  const programmatic = [...patternCounts.entries()]
    .filter(([, c]) => c >= 10)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return {
    found: urls.length > 0,
    urlCount: urls.length,
    sections,
    programmatic,
    updatedLast90Days: recent,
    newestLastmod: newest,
    sampleUrls: urls.slice(0, 40).map((u) => u.loc),
  };
}

async function fetchSitemap(origin: string, robotsSitemaps: string[]): Promise<SitemapSummary> {
  const candidates = uniq([...robotsSitemaps, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]).slice(0, 3);
  for (const c of candidates) {
    const r = await tryFetch(c, { timeoutMs: 8000, maxBytes: 5_000_000 });
    if (!r || !/<(urlset|sitemapindex)/i.test(r.text)) continue;
    let entries = locs(r.text);
    if (/<sitemapindex/i.test(r.text)) {
      // Prefer child sitemaps that look like content (posts, pages, blog) and cap at 4.
      const children = entries
        .map((e) => e.loc)
        .sort((a, b) => Number(/post|blog|page|article/i.test(b)) - Number(/post|blog|page|article/i.test(a)))
        .slice(0, 4);
      const childResults = await Promise.all(children.map((c) => tryFetch(c, { timeoutMs: 8000, maxBytes: 5_000_000 })));
      entries = childResults.flatMap((cr) => (cr ? locs(cr.text) : []));
    }
    if (entries.length) return summarizeSitemap(entries);
  }
  return summarizeSitemap([]);
}

function findLink(links: LinkRef[], re: RegExp, origin: string): string | null {
  const hit = links.find((l) => {
    try {
      const u = new URL(l.href);
      return u.origin === origin && (re.test(u.pathname) || re.test(l.text));
    } catch {
      return false;
    }
  });
  return hit?.href ?? null;
}

export async function crawlSite(inputUrl: string, opts: { deep?: boolean } = { deep: true }): Promise<SiteSignals> {
  const start = normalizeUrl(inputUrl);
  const notes: string[] = [];
  const homeRes = await safeFetch(start);
  if (!homeRes.ok) notes.push(`Homepage returned HTTP ${homeRes.status}. Some sites block automated readers; results may be thin.`);

  const finalUrl = new URL(homeRes.url);
  const origin = finalUrl.origin;
  const rawHtml = homeRes.text;
  const { page: home, $ } = snapshotPage(rawHtml, finalUrl.toString());
  const $raw = cheerio.load(rawHtml);

  const links: LinkRef[] = [];
  $raw("a[href]").each((_, el) => {
    const href = $raw(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    try {
      links.push({ text: clean($raw(el).text(), 80), href: new URL(href, finalUrl).toString() });
    } catch {
      /* ignore malformed hrefs */
    }
  });

  const navLinks = uniq(
    $raw("nav a[href], header a[href]")
      .map((_, el) => {
        const href = $raw(el).attr("href");
        try {
          return href ? JSON.stringify({ text: clean($raw(el).text(), 60), href: new URL(href, finalUrl).toString() }) : "";
        } catch {
          return "";
        }
      })
      .get()
      .filter(Boolean),
  )
    .map((s) => JSON.parse(s) as LinkRef)
    .filter((l) => l.text)
    .slice(0, 40);

  const socials: { platform: string; url: string }[] = [];
  for (const l of links) {
    for (const [re, platform] of SOCIAL_HOSTS) {
      if (re.test(l.href) && !socials.some((s) => s.platform === platform) && !/share|intent|sharer/.test(l.href)) {
        socials.push({ platform, url: l.href.split("?")[0] });
      }
    }
  }

  const tech = TECH.filter(([re]) => re.test(rawHtml)).map(([, name, category]) => ({ name, category }));
  const uniqTech = tech.filter((t, i) => tech.findIndex((x) => x.name === t.name) === i);

  const schemaTypes: string[] = [];
  $raw('script[type="application/ld+json"]').each((_, el) => {
    const body = $raw(el).contents().text();
    for (const m of body.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) schemaTypes.push(m[1]);
  });

  const segmentRe = /\/(for|solutions|industries|use-cases|teams|roles|who-we-serve)\/[^/?#]+/i;
  const segments = uniq(
    links
      .filter((l) => segmentRe.test(l.href) && l.href.startsWith(origin))
      .map((l) => l.text || new URL(l.href).pathname),
  ).slice(0, 15);

  const linkText = links.map((l) => `${l.text} ${l.href}`).join("\n");
  const leadMagnets = LEAD_MAGNETS.filter(([re]) => re.test(linkText) || re.test(home.textSample)).map(([, n]) => n);

  const proofSignals: string[] = [];
  const bodyText = home.textSample;
  if (/trusted by|used by|loved by|join \d|over \d|\d[\d,.]*\+?\s*(customers|users|teams|companies|brands|businesses|members)/i.test(bodyText))
    proofSignals.push("Customer count / 'trusted by' claim");
  if (/testimonial|review|stars?|rated|★/i.test(bodyText)) proofSignals.push("Testimonials or ratings");
  if (/case stud(y|ies)|customer stor(y|ies)/i.test(linkText)) proofSignals.push("Case studies");
  if (/as seen in|featured in|press/i.test(bodyText)) proofSignals.push("Press mentions");
  if (/award|winner|leader/i.test(bodyText)) proofSignals.push("Awards / analyst badges");
  if (/guarantee|money.back|refund/i.test(bodyText)) proofSignals.push("Guarantee");
  if (/soc ?2|gdpr|hipaa|iso ?27001/i.test(bodyText)) proofSignals.push("Security / compliance badges");

  const utmCampaigns = uniq(
    links.flatMap((l) => {
      try {
        const c = new URL(l.href).searchParams.get("utm_campaign");
        return c ? [c] : [];
      } catch {
        return [];
      }
    }),
  ).slice(0, 15);

  const emailCapture =
    $raw('input[type="email"]').length > 0 || /subscribe|newsletter|join our list|get updates/i.test(bodyText);

  const pricingUrl = findLink(links, /pricing|plans|price/i, origin);
  const blogUrl = findLink(links, /\/(blog|resources|insights|articles|news|journal|learn|guides)\b/i, origin);

  const robotsP = tryFetch(`${origin}/robots.txt`, { timeoutMs: 6000 });
  const llmsP = tryFetch(`${origin}/llms.txt`, { timeoutMs: 6000 });
  const pricingP = opts.deep && pricingUrl ? tryFetch(pricingUrl) : Promise.resolve(null);
  const blogP = opts.deep && blogUrl ? tryFetch(blogUrl) : Promise.resolve(null);

  const [robotsRes, llmsRes, pricingRes, blogRes] = await Promise.all([robotsP, llmsP, pricingP, blogP]);
  const robots = robotsRes && /user-agent|disallow|sitemap/i.test(robotsRes.text)
    ? { found: true, ...parseRobots(robotsRes.text) }
    : { found: false, disallow: [], sitemaps: [] };
  const sitemap = await fetchSitemap(origin, robots.sitemaps);

  const pricingPage = pricingRes ? snapshotPage(pricingRes.text, pricingRes.url).page : null;
  const blogPage = blogRes ? snapshotPage(blogRes.text, blogRes.url).page : null;
  const pricingText = `${pricingPage?.textSample ?? ""} ${home.textSample}`;

  if (!sitemap.found) notes.push("No sitemap found, so page counts and publishing rate are unknown.");
  if (home.wordCount < 80) notes.push("Very little server-rendered text. The site may render with JavaScript, so on-page findings are partial.");

  return {
    inputUrl,
    finalUrl: finalUrl.toString(),
    domain: finalUrl.hostname.replace(/^www\./, ""),
    fetchedAt: new Date().toISOString(),
    reachable: homeRes.ok,
    home,
    lang: clean($raw("html").attr("lang"), 10),
    ogTitle: clean($raw('meta[property="og:title"]').attr("content")),
    ogDescription: clean($raw('meta[property="og:description"]').attr("content"), 320),
    navLinks,
    socials,
    tech: uniqTech,
    schemaTypes: uniq(schemaTypes).slice(0, 15),
    segments,
    leadMagnets: uniq(leadMagnets),
    proofSignals,
    utmCampaigns,
    emailCapture,
    pricing: {
      pageUrl: pricingPage?.url ?? pricingUrl,
      pricePoints: uniq([...(pricingPage?.pricePoints ?? []), ...home.pricePoints]).slice(0, 12),
      freeTrial: /free trial|try (it )?free|\d+[- ]day trial/i.test(pricingText),
      freePlan: /free (plan|forever|tier)|\$0\b|free for/i.test(pricingText),
      contactSales: /contact sales|talk to sales|custom pricing|request (a )?quote|enterprise/i.test(pricingText),
      annualDiscount: /annual(ly)?|billed yearly|save \d+%|2 months free/i.test(pricingText),
      moneyBackGuarantee: /money.back|refund|guarantee/i.test(pricingText),
    },
    pricingPage,
    blogPage,
    robots,
    sitemap,
    llmsTxt: !!llmsRes && llmsRes.text.length > 20 && !/<html/i.test(llmsRes.text),
    notes,
  };
}
