import type { CompareRow, SiteSignals } from "./types";

// "Where you stand today" for existing brands: a side-by-side of observable
// signals on your site and the competitor's. Deterministic (no AI), so every
// row is something we actually saw on both sites.

const count = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? "" : "s"}` : "None");
const names = (xs: string[], none = "None detected") => (xs.length ? xs.slice(0, 4).join(", ") : none);

function row(area: string, you: string, them: string, youScore: number, themScore: number, action: string): CompareRow {
  const status = youScore > themScore ? "ahead" : youScore === themScore ? "even" : "behind";
  return { area, you, them, status, action: status === "behind" ? action : status === "even" ? "Hold your ground; improve quality before quantity." : "Keep it; this is an edge to talk about." };
}

const blogCount = (s: SiteSignals) =>
  s.sitemap.sections.filter((x) => /blog|resources|articles|insights|news|guides|learn/.test(x.path)).reduce((a, x) => a + x.count, 0);

export function compareSites(you: SiteSignals, them: SiteSignals): CompareRow[] {
  const ads = (s: SiteSignals) => s.tech.filter((t) => t.category === "ads").map((t) => t.name);
  const email = (s: SiteSignals) => s.tech.filter((t) => t.category === "crm/email").map((t) => t.name);
  const analytics = (s: SiteSignals) => s.tech.filter((t) => t.category === "analytics" || t.category === "cro").map((t) => t.name);
  const socials = (s: SiteSignals) => s.socials.map((x) => x.platform);

  const rows: CompareRow[] = [
    row(
      "Search footprint (pages in sitemap)",
      you.sitemap.found ? count(you.sitemap.urlCount, "page") : "No sitemap",
      them.sitemap.found ? count(them.sitemap.urlCount, "page") : "No sitemap",
      you.sitemap.urlCount >= them.sitemap.urlCount * 0.8 ? 2 : you.sitemap.urlCount ? 1 : 0,
      2,
      "Publish a sitemap and start a pillar-and-cluster content plan; see the SEO plan section.",
    ),
    row(
      "Content (blog / resource pages)",
      count(blogCount(you), "article"),
      count(blogCount(them), "article"),
      Math.min(blogCount(you), 50),
      Math.min(blogCount(them), 50),
      "Use the 12-week content calendar; consistency beats volume.",
    ),
    row(
      "Fresh content (updated in last 90 days)",
      count(you.sitemap.updatedLast90Days, "page"),
      count(them.sitemap.updatedLast90Days, "page"),
      Math.min(you.sitemap.updatedLast90Days, 20),
      Math.min(them.sitemap.updatedLast90Days, 20),
      "Refresh your top 5 pages and publish weekly.",
    ),
    row(
      "Programmatic SEO pages",
      names(you.sitemap.programmatic.map((p) => `${p.pattern} (${p.count})`), "None"),
      names(them.sitemap.programmatic.map((p) => `${p.pattern} (${p.count})`), "None"),
      you.sitemap.programmatic.length,
      them.sitemap.programmatic.length,
      "Build one templated page type (e.g. /for/{industry}); see the programmatic idea in the SEO plan.",
    ),
    row("Ad and retargeting pixels", names(ads(you)), names(ads(them)), ads(you).length ? 1 : 0, ads(them).length ? 1 : 0, "Install Meta and Google pixels now so you can retarget once organic proves a message."),
    row("Email / CRM", names(email(you)), names(email(them)), (email(you).length ? 1 : 0) + (you.emailCapture ? 1 : 0), (email(them).length ? 1 : 0) + (them.emailCapture ? 1 : 0), "Add an email capture with a lead magnet and a welcome sequence; see the email plan."),
    row("Analytics and testing", names(analytics(you)), names(analytics(them)), analytics(you).length ? 1 : 0, analytics(them).length ? 1 : 0, "Add analytics plus a heatmap tool (Clarity is free) before spending on traffic."),
    row("Lead magnets / entry offers", names(you.leadMagnets), names(them.leadMagnets), Math.min(you.leadMagnets.length, 3), Math.min(them.leadMagnets.length, 3), "Create one free entry offer (checklist, template or calculator)."),
    row("Trust signals", names(you.proofSignals), names(them.proofSignals), Math.min(you.proofSignals.length, 3), Math.min(them.proofSignals.length, 3), "Put 3 customer quotes with numbers above the fold."),
    row("Segment pages (/for/, /solutions/)", count(you.segments.length, "page"), count(them.segments.length, "page"), Math.min(you.segments.length, 3), Math.min(them.segments.length, 3), "Build one page per key audience with matched messaging."),
    row(
      "Public pricing",
      you.pricing.pricePoints.length ? you.pricing.pricePoints.slice(0, 3).join(", ") : "Not public",
      them.pricing.pricePoints.length ? them.pricing.pricePoints.slice(0, 3).join(", ") : "Not public",
      you.pricing.pricePoints.length ? 1 : 0,
      them.pricing.pricePoints.length ? 1 : 0,
      "Consider showing a starting price; buyers who want transparency choose the brand that shows it.",
    ),
    row("Social profiles linked", names(socials(you)), names(socials(them)), Math.min(socials(you).length, 4), Math.min(socials(them).length, 4), "Link your active profiles in the footer; focus on one channel first."),
    row("Structured data (rich results)", names(you.schemaTypes), names(them.schemaTypes), you.schemaTypes.length ? 1 : 0, them.schemaTypes.length ? 1 : 0, "Add Organization and Product/FAQ schema."),
    row("AI search readiness (llms.txt)", you.llmsTxt ? "Present" : "Absent", them.llmsTxt ? "Present" : "Absent", you.llmsTxt ? 1 : 0, them.llmsTxt ? 1 : 0, "Publish an llms.txt so AI answer engines can read your site."),
  ];
  return rows;
}

/** Short headline numbers for the summary. */
export function compareSummary(rows: CompareRow[]) {
  return {
    ahead: rows.filter((r) => r.status === "ahead").length,
    even: rows.filter((r) => r.status === "even").length,
    behind: rows.filter((r) => r.status === "behind").length,
  };
}
