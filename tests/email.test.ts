import assert from "node:assert/strict";
import { test } from "node:test";
import { reportEmail } from "../src/lib/email";
import type { Report } from "../src/lib/types";

const teardown = {
  competitor: "Rival <script>", url: "https://rival.com", generatedAt: "2026-10-18", engine: "test",
  summary: "They win on SEO & email.", positioning: { oneLiner: "", targetAudience: "", awarenessStage: "", sophisticationStage: "", coreOffer: "", primaryCta: "" },
  audience: { segments: [], painsAddressed: [], objectionsHandled: [] }, channels: [],
  content: { pillars: [], formats: [], cadence: "", ctaPattern: "", hookStyle: "" },
  seo: { pageTypes: [], programmatic: [], keywordThemes: [], observations: [] },
  funnel: { entryOffer: "", coreOffer: "", pricingModel: "", upgradeGate: "", steps: [] },
  techStack: [], whatWorks: [], gaps: ["No YouTube"], quickWins: [],
} satisfies Report["teardown"];

test("free email escapes HTML, lists gaps and upsells", () => {
  const e = reportEmail({ tier: "free", teardown }, "https://app.example");
  assert.match(e.subject, /Rival <script>'s marketing/);
  assert.ok(!e.html.includes("<script>"));
  assert.ok(e.html.includes("Rival &lt;script&gt;"));
  assert.ok(e.html.includes("SEO &amp; email"));
  assert.ok(e.html.includes("No YouTube"));
  assert.ok(e.html.includes("https://app.example"));
  assert.ok(e.text.includes("Get your full marketing plan"));
});

test("printable HTML report escapes content and includes sections", async () => {
  const { reportHtml } = await import("../src/lib/reportHtml");
  const html = reportHtml({ tier: "free", teardown }, "https://app.example");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Rival &lt;script&gt;"));
  assert.ok(html.includes(">09</span>Gaps: their blind spots"));
  assert.ok(html.includes("window.print()"));
  assert.ok(html.includes("https://app.example"));
});
