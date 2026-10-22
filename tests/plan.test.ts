import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBrand } from "../src/lib/brandInput";
import { compareSites } from "../src/lib/compare";
import type { SiteSignals } from "../src/lib/types";

function site(over: Partial<SiteSignals> = {}): SiteSignals {
  const page = { url: "", title: "", metaDescription: "", h1: [], h2: [], ctas: [], textSample: "", wordCount: 0, pricePoints: [] };
  return {
    inputUrl: "", finalUrl: "", domain: "x.com", fetchedAt: "", reachable: true, home: page, lang: "", ogTitle: "", ogDescription: "",
    navLinks: [], socials: [], tech: [], schemaTypes: [], segments: [], leadMagnets: [], proofSignals: [], utmCampaigns: [], emailCapture: false,
    pricing: { pageUrl: null, pricePoints: [], freeTrial: false, freePlan: false, contactSales: false, annualDiscount: false, moneyBackGuarantee: false },
    pricingPage: null, blogPage: null, robots: { found: false, disallow: [], sitemaps: [] },
    sitemap: { found: false, urlCount: 0, sections: [], programmatic: [], updatedLast90Days: 0, newestLastmod: null, sampleUrls: [] },
    llmsTxt: false, notes: [], ...over,
  };
}

test("validateBrand: existing needs name + website, fresh start needs offer + audience", () => {
  assert.ok("error" in validateBrand({ stage: "existing", brandName: "A" }));
  assert.ok("error" in validateBrand({ stage: "existing", brandName: "A", domain: "http://localhost/x" }));
  const ok = validateBrand({ stage: "existing", brandName: "A", domain: "a.com" });
  assert.ok("brand" in ok && ok.brand.stage === "existing");
  assert.ok("error" in validateBrand({ stage: "new", niche: "candles" }));
  const fresh = validateBrand({ stage: "new", niche: "candles", audience: "gift buyers", domain: "ignored.com" });
  assert.ok("brand" in fresh && fresh.brand.stage === "new" && fresh.brand.domain === "" && fresh.brand.brandName === "");
  // Unknown stage falls back to existing.
  assert.ok("error" in validateBrand({ stage: "weird" }));
});

test("compareSites marks gaps from observed signals only", () => {
  const you = site({ tech: [{ name: "Google Analytics", category: "analytics" }] });
  const them = site({
    tech: [{ name: "Meta Pixel", category: "ads" }, { name: "Google Analytics", category: "analytics" }],
    sitemap: { found: true, urlCount: 120, sections: [{ path: "/blog/", count: 60 }], programmatic: [{ pattern: "/integrations/{slug}", count: 40 }], updatedLast90Days: 30, newestLastmod: null, sampleUrls: [] },
    llmsTxt: true,
  });
  const rows = compareSites(you, them);
  const by = (a: string) => rows.find((r) => r.area.startsWith(a))!;
  assert.equal(by("Ad and retargeting").status, "behind");
  assert.match(by("Ad and retargeting").action, /pixel/i);
  assert.equal(by("Analytics").status, "even");
  assert.equal(by("Search footprint").you, "No sitemap");
  assert.equal(by("Search footprint").them, "120 pages");
  assert.equal(by("AI search readiness").status, "behind");
  assert.ok(rows.length >= 12);
  // A brand that outdoes the competitor is "ahead".
  assert.equal(compareSites(them, you).find((r) => r.area.startsWith("Ad and retargeting"))!.status, "ahead");
});
