import type { CompetitorTeardown, ProPlan, Report } from "./types";

// A self-contained, printable HTML version of the report. It is built in the
// browser with no server or PDF library involved, and "Save as PDF" uses the
// browser's own print dialog, so it works even when server-side PDF fails.

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const list = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">Not detected.</p>`);

const kv = (rows: [string, string][]) => {
  const r = rows.filter(([, v]) => v);
  return r.length ? `<dl>${r.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "";
};

const table = (head: string[], rows: string[][]) =>
  rows.length
    ? `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`
    : "";

const section = (title: string, body: string) => (body.trim() ? `<section><h2>${esc(title)}</h2>${body}</section>` : "");
const h3 = (t: string, body: string) => (body.trim() ? `<h3>${esc(t)}</h3>${body}` : "");

function teardownHtml(d: CompetitorTeardown): string {
  return [
    section("1. Executive summary", `<div class="callout">${esc(d.summary)}</div>`),
    section(
      "2. Positioning",
      kv([
        ["One-liner", d.positioning.oneLiner],
        ["Target audience", d.positioning.targetAudience],
        ["Awareness stage", d.positioning.awarenessStage],
        ["Sophistication", d.positioning.sophisticationStage],
        ["Core offer", d.positioning.coreOffer],
        ["Primary CTA", d.positioning.primaryCta],
      ]),
    ),
    section(
      "3. Audience",
      h3("Segments", list(d.audience.segments)) + h3("Pains they address", list(d.audience.painsAddressed)) + h3("Objections they handle", list(d.audience.objectionsHandled)),
    ),
    section(
      "4. Channel map",
      d.channels
        .map(
          (c) =>
            `<div class="card"><div class="row"><b>${esc(c.channel)}</b><span class="pill ${esc(c.status)}">${esc(c.status)}</span></div><p>${esc(c.evidence)}</p>${
              c.role ? `<p class="muted">${esc(c.role)}</p>` : ""
            }</div>`,
        )
        .join(""),
    ),
    section(
      "5. Content engine",
      kv([
        ["Cadence", d.content.cadence],
        ["CTA pattern", d.content.ctaPattern],
        ["Hook style", d.content.hookStyle],
      ]) +
        h3("Pillars", list(d.content.pillars)) +
        h3("Formats", list(d.content.formats)),
    ),
    section(
      "6. SEO footprint",
      h3("Page types", list(d.seo.pageTypes)) + h3("Programmatic patterns", list(d.seo.programmatic)) + h3("Keyword themes", list(d.seo.keywordThemes)) + h3("Observations", list(d.seo.observations)),
    ),
    section(
      "7. Funnel and offer",
      kv([
        ["Entry offer", d.funnel.entryOffer],
        ["Core offer", d.funnel.coreOffer],
        ["Pricing model", d.funnel.pricingModel],
        ["Upgrade gate", d.funnel.upgradeGate],
      ]) +
        h3("Funnel steps", d.funnel.steps.length ? `<ol>${d.funnel.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : "") +
        h3("Tech stack detected", `<p>${esc(d.techStack.join(", ") || "None detected")}</p>`),
    ),
    section(
      "8. What works for them, and whether it transfers",
      table(["Tactic (mechanism)", "Evidence", "Why it works", "Transfer", "Cost to copy"], d.whatWorks.map((w) => [w.tactic, w.evidence, w.whyItWorks, w.transferable, w.costToCopy])),
    ),
    section("9. Gaps: their blind spots", list(d.gaps)),
    section("10. Quick wins for a smaller rival", list(d.quickWins)),
  ].join("");
}

function planHtml(p: ProPlan, comp: string): string {
  return [
    `<div class="part"><p class="kicker">PART TWO</p><h1>${esc(p.brandName)}: end-to-end marketing plan</h1><p class="muted">Built from the reverse-engineered playbook of ${esc(comp)}.</p></div>`,
    section("A. Executive summary", `<div class="callout">${esc(p.executiveSummary)}</div>`),
    section(
      "B. Positioning",
      `<div class="card"><b>${esc(p.positioning.statement)}</b></div>` +
        h3("Differentiators", list(p.positioning.differentiators)) +
        h3("Messaging pillars", list(p.positioning.messagingPillars)) +
        h3("Tagline options", list(p.positioning.taglines)),
    ),
    section(
      "C. Ideal customer",
      kv([
        ["Primary", p.icp.primary],
        ["Secondary", p.icp.secondary],
      ]) +
        h3("Pains", list(p.icp.pains)) +
        h3("Buying triggers", list(p.icp.triggers)) +
        h3("Where they gather", list(p.icp.whereTheyGather)),
    ),
    section(
      "D. Strategies",
      p.strategies
        .map(
          (x, i) =>
            `<div class="card"><b>${i + 1}. ${esc(x.name)}</b>${kv([
              ["Objective", x.objective],
              ["Borrowed mechanism", x.borrowedMechanism],
              ["Our twist", x.ourTwist],
              ["Why it will work", x.whyItWillWork],
            ])}</div>`,
        )
        .join(""),
    ),
    section("E. Channel plan", table(["Channel", "Priority", "Goal", "Tactics", "KPI", "Effort"], p.channelPlan.map((c) => [c.channel, c.priority, c.goal, c.tactics.join("; "), c.kpi, c.effort]))),
    section(
      "F. 30 / 60 / 90 day execution plan",
      p.executionPlan.map((ph) => h3(`${ph.phase}: ${ph.focus}`, table(["Task", "Hours", "Metric", "Kill rule"], ph.tasks.map((x) => [x.task, x.hours, x.metric, x.killRule])))).join(""),
    ),
    section(
      "G. Content plan",
      p.contentPlan.pillars.map((pl) => `<div class="card"><b>${esc(pl.name)}</b><p class="muted">${esc(pl.purpose)}</p>${list(pl.topics)}</div>`).join("") +
        h3("12-week content calendar", table(["Week", "Title", "Format", "Channel", "Stage", "Keyword"], p.contentPlan.calendar.map((c) => [String(c.week), c.title, c.format, c.channel, c.funnelStage, c.keyword]))) +
        h3("Repurposing chain (one asset, many derivatives)", list(p.contentPlan.repurposingChain)) +
        h3("Article skeleton", list(p.contentPlan.template)),
    ),
    section(
      "H. SEO plan",
      table(["Keyword", "Intent", "Page type"], p.seoPlan.keywords.map((k) => [k.keyword, k.intent, k.pageType])) +
        h3("Page types to build", list(p.seoPlan.pageTypesToBuild)) +
        kv([["Programmatic idea", p.seoPlan.programmaticIdea]]),
    ),
    section("I. Paid ads plan", table(["Angle", "Hook", "Offer", "Format"], p.adsPlan.angles.map((a) => [a.angle, a.hook, a.offer, a.format])) + kv([["Budget guidance", p.adsPlan.budgetGuidance]])),
    section("J. Email plan", kv([["Lead magnet", p.emailPlan.leadMagnet]]) + table(["Day", "Subject", "Goal"], p.emailPlan.sequence.map((e) => [String(e.day), e.subject, e.goal]))),
    section(
      "K. Swipe file (mechanisms, not material)",
      p.swipeFile
        .map(
          (w) =>
            `<div class="card"><b>${esc(w.mechanism)}</b>${kv([
              ["Why it works", w.whyItWorks],
              ["Blank version", w.blankVersion],
              ["Your version", w.yourVersion],
            ])}</div>`,
        )
        .join(""),
    ),
    section("L. Gaps to exploit", list(p.gapsToExploit)),
    section("M. KPIs", table(["Metric", "Day 30", "Day 90"], p.kpis.map((k) => [k.metric, k.target30, k.target90]))),
    section("N. Risks and honest caveats", list(p.risks)),
  ].join("");
}

export function reportHtml(r: Report, appUrl: string): string {
  const d = r.teardown;
  const date = d.generatedAt.slice(0, 10);
  const title = r.plan ? `${r.plan.brandName} vs ${d.competitor}` : d.competitor;
  const upsell = r.plan
    ? ""
    : `<section class="callout upsell"><h2>Turn this teardown into your own marketing plan</h2><p>The full report adds positioning, strategies, a 30/60/90 plan with kill rules, a 12-week content calendar, SEO keywords, ad angles, an email sequence and a swipe file for your brand.</p><p><a href="${esc(appUrl)}">Get it at ${esc(appUrl)}</a></p></section>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - Marketing Scholars ${r.plan ? "full report" : "teardown"}</title>
<style>
  :root { --ink:#14161f; --muted:#5b6070; --line:#e3e5eb; --brand:#4f46e5; --soft:#eef0ff; --ok:#0f766e; --bad:#b91c1c; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f7f7fb; color:var(--ink); font:15px/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .bar { position:sticky; top:0; background:var(--ink); color:#fff; padding:10px 16px; display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; z-index:1; }
  .bar button { background:var(--brand); color:#fff; border:0; border-radius:8px; padding:10px 16px; font:inherit; font-weight:700; cursor:pointer; }
  .bar small { opacity:.8; }
  main { max-width:860px; margin:0 auto; padding:24px 16px 60px; background:#fff; }
  .cover { padding:28px 0 18px; border-bottom:2px solid var(--ink); margin-bottom:18px; }
  .kicker { color:var(--brand); font-weight:700; letter-spacing:.12em; font-size:12px; margin:0 0 6px; }
  h1 { font-size:30px; line-height:1.15; margin:0 0 8px; letter-spacing:-.02em; }
  h2 { color:var(--brand); font-size:20px; margin:28px 0 10px; }
  h3 { font-size:15px; margin:16px 0 6px; }
  p { margin:0 0 8px; }
  .muted { color:var(--muted); }
  .callout { background:var(--soft); border-radius:8px; padding:14px 16px; }
  .card { border:1px solid var(--line); border-radius:8px; padding:12px 14px; margin:0 0 10px; }
  .row { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:4px; }
  .pill { font-size:11px; text-transform:uppercase; font-weight:700; color:#fff; padding:2px 8px; border-radius:4px; background:var(--muted); }
  .pill.active { background:var(--ok); } .pill.likely { background:var(--brand); } .pill.absent { background:var(--bad); }
  dl { display:grid; grid-template-columns:minmax(110px, 170px) 1fr; gap:4px 14px; margin:6px 0; }
  dt { font-weight:700; color:var(--muted); font-size:13px; } dd { margin:0; }
  ul, ol { margin:4px 0 8px; padding-left:20px; } li { margin-bottom:3px; }
  .tw { overflow-x:auto; margin:6px 0 12px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; border-bottom:2px solid var(--ink); padding:6px; } td { border-bottom:1px solid var(--line); padding:6px; vertical-align:top; }
  .part { margin-top:36px; padding-top:20px; border-top:2px solid var(--ink); }
  .upsell { margin-top:28px; } .upsell h2 { margin-top:0; }
  footer { color:var(--muted); font-size:12px; margin-top:30px; border-top:1px solid var(--line); padding-top:10px; }
  @media (max-width:600px) { dl { grid-template-columns:1fr; } dt { margin-top:6px; } h1 { font-size:24px; } }
  @page { size:A4; margin:16mm 14mm; }
  @media print {
    body { background:#fff; font-size:11.5px; } .bar { display:none; } main { max-width:none; padding:0; }
    .card, tr, dl, .callout { break-inside:avoid; } h2, h3 { break-after:avoid; } .part { break-before:page; }
    a { color:var(--ink); text-decoration:none; } .tw { overflow:visible; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style></head>
<body>
<div class="bar"><span><b>Marketing Scholars</b> <small>${esc(title)}</small></span><span><small>Choose "Save as PDF" as the printer</small> <button onclick="window.print()">Save as PDF</button></span></div>
<main>
  <div class="cover">
    <p class="kicker">${r.plan ? "FULL REPORT" : "FREE TEARDOWN"}</p>
    <h1>${esc(title)}</h1>
    <p class="muted">${r.plan ? "Reverse-engineered competitor teardown and your end-to-end marketing plan" : "Reverse-engineered marketing teardown"}</p>
    ${kv([
      ["Competitor", d.url],
      ["Your brand", r.plan ? `${r.plan.brandName} (${r.plan.domain})` : ""],
      ["Generated", date],
      ["Analysis engine", d.engine],
    ])}
  </div>
  ${teardownHtml(d)}
  ${r.plan ? planHtml(r.plan, d.competitor) : upsell}
  <footer>Method: public pages only (homepage, pricing, blog, robots.txt, sitemap, llms.txt). Observations are labelled; inferences are marked as such. Traffic and spend are never stated as numbers. Copy the mechanism, never the material. Marketing Scholars, ${esc(date)}.</footer>
</main>
</body></html>`;
}
