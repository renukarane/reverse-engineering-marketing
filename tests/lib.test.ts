import assert from "node:assert/strict";
import { test } from "node:test";
import { extractJson } from "../src/lib/ai";
import { extractPricePoints, snapshotPage, summarizeSitemap } from "../src/lib/crawler";
import { cleanText, normalizePlan, normalizeTeardown } from "../src/lib/normalize";
import { isPrivateIp, normalizeUrl } from "../src/lib/safeFetch";

test("isPrivateIp blocks internal ranges and allows public ones", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("normalizeUrl adds https and rejects unsafe targets", () => {
  assert.equal(normalizeUrl("example.com").toString(), "https://example.com/");
  assert.throws(() => normalizeUrl("http://localhost/admin"));
  assert.throws(() => normalizeUrl("http://169.254.169.254/latest"));
  assert.throws(() => normalizeUrl("ftp://example.com"));
  assert.throws(() => normalizeUrl("http://example.com:8080"));
  assert.throws(() => normalizeUrl("http://user:pw@example.com"));
});

test("summarizeSitemap counts sections, programmatic patterns and recency", () => {
  const now = Date.parse("2026-10-01");
  const urls = [
    ...Array.from({ length: 12 }, (_, i) => ({ loc: `https://x.com/integrations/t${i}`, lastmod: "2026-01-01" })),
    ...Array.from({ length: 5 }, (_, i) => ({ loc: `https://x.com/en/blog/p${i}`, lastmod: "2026-09-20" })),
    { loc: "https://x.com/", lastmod: null },
  ];
  const s = summarizeSitemap(urls, now);
  assert.equal(s.urlCount, 18);
  assert.deepEqual(s.sections[0], { path: "/integrations/", count: 12 });
  assert.deepEqual(s.programmatic, [{ pattern: "/integrations/{slug}", count: 12 }]);
  assert.equal(s.updatedLast90Days, 5);
  assert.equal(s.newestLastmod, "2026-09-20");
});

test("snapshotPage extracts headings, CTAs and prices", () => {
  const { page } = snapshotPage("<title>T</title><h1>Big promise</h1><h2>Sub</h2><a>Start free trial</a><a>About</a><p>Only $29/mo</p>", "https://x.com/");
  assert.deepEqual(page.h1, ["Big promise"]);
  assert.ok(page.ctas.includes("Start free trial"));
  assert.ok(!page.ctas.includes("About"));
  assert.deepEqual(page.pricePoints, ["$29/mo"]);
  assert.deepEqual(extractPricePoints("from €9 per month or 99 USD/yr"), ["€9 per month", "99 USD/yr"]);
});

test("extractJson tolerates fences and chatter", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Here: {"a":{"b":2}} done'), { a: { b: 2 } });
  assert.throws(() => extractJson("no json"));
});

test("normalizers coerce messy model output and strip em dashes", () => {
  assert.equal(cleanText("a — b"), "a, b");
  const t = normalizeTeardown(
    { summary: "x", channels: [{ channel: "SEO", status: "ACTIVE" }, { status: "active" }, "junk"], whatWorks: [{ tactic: "t", transferable: "maybe" }], gaps: "one gap" },
    { competitor: "C", url: "u", generatedAt: "g", engine: "e" },
  );
  assert.equal(t.channels.length, 1);
  assert.equal(t.channels[0].status, "active");
  assert.equal(t.whatWorks[0].transferable, "modified");
  assert.deepEqual(t.gaps, ["one gap"]);
  assert.deepEqual(t.audience.segments, []);
  const p = normalizePlan({ channelPlan: [{ channel: "SEO", priority: "p1" }], contentPlan: { calendar: [{ title: "A" }, { title: "B", week: "7" }] } }, { brandName: "B", domain: "d", stage: "existing" });
  assert.equal(p.channelPlan[0].priority, "P1");
  assert.deepEqual(p.contentPlan.calendar.map((c) => c.week), [1, 7]);
});
