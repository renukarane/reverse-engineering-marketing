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

// Collected while sections render, then printed as the contents list.
let tocItems: { id: string; num: string; name: string; part: string }[] = [];
let tocPart = "Competitor teardown";

const section = (title: string, body: string) => {
  if (!body.trim()) return "";
  const m = title.match(/^([0-9A-Z]{1,2})\.\s+(.*)$/);
  const num = m ? (/^\d+$/.test(m[1]) ? m[1].padStart(2, "0") : m[1]) : "";
  const name = m ? m[2] : title;
  const id = `s-${tocPart}-${num}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  tocItems.push({ id, num, name, part: tocPart });
  return `<section id="${id}"><h2>${num ? `<span class="num">${num}</span>` : ""}${esc(name)}</h2><span class="rule"></span>${body}</section>`;
};

function tocHtml(): string {
  const parts = [...new Set(tocItems.map((x) => x.part))];
  return `<nav class="toc" aria-label="Contents"><p class="kicker">CONTENTS</p>${parts
    .map(
      (p) =>
        `<h3>${esc(p)}</h3><ol>${tocItems
          .filter((x) => x.part === p)
          .map((x) => `<li><a href="#${x.id}"><span class="tnum">${esc(x.num)}</span>${esc(x.name)}</a></li>`)
          .join("")}</ol>`,
    )
    .join("")}</nav>`;
}
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
  let n = 0;
  const L = (title: string) => `${String.fromCharCode(65 + n++)}. ${title}`;
  const statusPill = (st: string) => `<span class="pill ${st === "ahead" ? "active" : st === "even" ? "likely" : "absent"}">${esc(st)}</span>`;
  return [
    `<div class="part"><p class="kicker">PART TWO</p><h1>${esc(p.brandName)}: your marketing plan</h1><p class="muted">Built from what already works for ${esc(comp)}. Study it, then build yours.</p></div>`,
    section(L("Executive summary"), `<div class="callout">${esc(p.executiveSummary)}</div>`),
    p.currentState
      ? section(
          L("Where you stand today"),
          `<div class="callout">${esc(p.currentState.summary)}</div>` +
            h3("Fix these first", list(p.currentState.priorities)) +
            (p.currentState.strengths.length ? h3("Already working for you", list(p.currentState.strengths)) : ""),
        )
      : "",
    p.currentState?.compare.length
      ? section(
          L("You vs them, side by side"),
          `<p class="muted">Observed on both public sites. Ahead / even / behind compares what each site shows, not quality.</p><div class="tw"><table><thead><tr><th>Area</th><th>${esc(p.brandName)}</th><th>${esc(comp)}</th><th></th><th>What to do</th></tr></thead><tbody>${p.currentState.compare
            .map((r) => `<tr><td>${esc(r.area)}</td><td>${esc(r.you)}</td><td>${esc(r.them)}</td><td>${statusPill(r.status)}</td><td>${esc(r.action)}</td></tr>`)
            .join("")}</tbody></table></div>`,
        )
      : "",
    p.launchKit
      ? section(
          L("Launch kit"),
          (p.launchKit.nameIdeas.length ? h3("Brand name ideas", list(p.launchKit.nameIdeas)) : "") +
            h3("Website pages to build first", list(p.launchKit.websitePages.map((w) => `${w.page}: ${w.purpose}`))) +
            h3("Homepage outline", `<ol>${p.launchKit.homepageOutline.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`) +
            h3("Launch checklist", table(["Task", "Why"], p.launchKit.launchChecklist.map((c) => [c.task, c.why]))),
        )
      : "",
    section(
      L("Positioning"),
      `<div class="card"><b>${esc(p.positioning.statement)}</b></div>` +
        h3("Differentiators", list(p.positioning.differentiators)) +
        h3("Messaging pillars", list(p.positioning.messagingPillars)) +
        h3("Tagline options", list(p.positioning.taglines)),
    ),
    section(
      L("Ideal customer"),
      kv([
        ["Primary", p.icp.primary],
        ["Secondary", p.icp.secondary],
      ]) +
        h3("Pains", list(p.icp.pains)) +
        h3("Buying triggers", list(p.icp.triggers)) +
        h3("Where they gather", list(p.icp.whereTheyGather)),
    ),
    section(
      L("Strategies"),
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
    section(L("Channel plan"), table(["Channel", "Priority", "Goal", "Tactics", "KPI", "Effort"], p.channelPlan.map((c) => [c.channel, c.priority, c.goal, c.tactics.join("; "), c.kpi, c.effort]))),
    section(
      L("30 / 60 / 90 day execution plan"),
      p.executionPlan.map((ph) => h3(`${ph.phase}: ${ph.focus}`, table(["Task", "Hours", "Metric", "Kill rule"], ph.tasks.map((x) => [x.task, x.hours, x.metric, x.killRule])))).join(""),
    ),
    section(
      L("Content plan"),
      p.contentPlan.pillars.map((pl) => `<div class="card"><b>${esc(pl.name)}</b><p class="muted">${esc(pl.purpose)}</p>${list(pl.topics)}</div>`).join("") +
        h3("12-week content calendar", table(["Week", "Title", "Format", "Channel", "Stage", "Keyword"], p.contentPlan.calendar.map((c) => [String(c.week), c.title, c.format, c.channel, c.funnelStage, c.keyword]))) +
        h3("Repurposing chain (one asset, many derivatives)", list(p.contentPlan.repurposingChain)) +
        h3("Article skeleton", list(p.contentPlan.template)),
    ),
    section(
      L("SEO plan"),
      table(["Keyword", "Intent", "Page type"], p.seoPlan.keywords.map((k) => [k.keyword, k.intent, k.pageType])) +
        h3("Page types to build", list(p.seoPlan.pageTypesToBuild)) +
        kv([["Programmatic idea", p.seoPlan.programmaticIdea]]),
    ),
    section(L("Paid ads plan"), table(["Angle", "Hook", "Offer", "Format"], p.adsPlan.angles.map((a) => [a.angle, a.hook, a.offer, a.format])) + kv([["Budget guidance", p.adsPlan.budgetGuidance]])),
    section(L("Email plan"), kv([["Lead magnet", p.emailPlan.leadMagnet]]) + table(["Day", "Subject", "Goal"], p.emailPlan.sequence.map((e) => [String(e.day), e.subject, e.goal]))),
    section(
      L("Swipe file (mechanisms, not material)"),
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
    section(L("Gaps to exploit"), list(p.gapsToExploit)),
    section(L("KPIs"), table(["Metric", "Day 30", "Day 90"], p.kpis.map((k) => [k.metric, k.target30, k.target90]))),
    section(L("Risks and honest caveats"), list(p.risks)),
  ].join("");
}

export function reportHtml(r: Report, appUrl: string): string {
  tocItems = [];
  tocPart = "Competitor teardown";
  const d = r.teardown;
  const teardownBody = teardownHtml(d);
  tocPart = "Your plan";
  const planBody = r.plan ? planHtml(r.plan, d.competitor) : "";
  const date = d.generatedAt.slice(0, 10);
  const title = r.plan ? `${r.plan.brandName} vs ${d.competitor}` : d.competitor;
  const upsell = r.plan
    ? ""
    : `<section class="upsell"><h2>You've studied their strategy. Now build yours.</h2><p>The full report adds positioning, strategies, a 30/60/90 plan with kill rules, a 12-week content calendar, SEO keywords, ad angles, an email sequence and a swipe file for your brand.</p><p><a href="${esc(appUrl)}">Build your plan →</a></p></section>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - Marketing Scholars ${r.plan ? "full report" : "teardown"}</title>
<style>
  :root { --ink:#141210; --muted:#5d574e; --line:#e4ddcf; --paper:#f6f2ea; --surface:#fffdf8; --brand:#ff4d2e; --yellow:#ffc83d; --blue:#1b4dff; --soft:#fff1d6; --ok:#0f7a5c; --bad:#c62828;
    --serif: ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:15px/1.6 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .bar { position:sticky; top:0; background:var(--ink); color:#fff; padding:10px 16px; display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; z-index:1; }
  .bar button { background:var(--brand); color:#fff; border:0; border-radius:8px; padding:10px 16px; font:inherit; font-weight:700; cursor:pointer; box-shadow:3px 3px 0 var(--yellow); }
  .bar small { opacity:.8; }
  .bar .mark, .brand .mark { display:inline-block; width:14px; height:14px; border-radius:50%; vertical-align:-2px; margin-right:6px; background:conic-gradient(var(--ink) 0 50%, var(--brand) 50% 100%); box-shadow:0 0 0 1.5px #fff; }
  main { max-width:880px; margin:22px auto 60px; padding:28px clamp(16px,4vw,44px) 40px; background:var(--surface); border:2px solid var(--ink); border-radius:12px; box-shadow:8px 8px 0 var(--ink); }
  .cover { padding:10px 0 22px; border-bottom:2px solid var(--ink); margin-bottom:22px; }
  .brand { font-weight:800; margin:0 0 30px; } .brand b { color:var(--brand); }
  .kicker { display:inline-block; color:var(--brand); border:1.5px solid var(--brand); border-radius:999px; padding:3px 10px; font-weight:700; letter-spacing:.12em; font-size:11px; margin:0 0 14px; }
  h1 { font-family:var(--serif); font-size:clamp(30px,5vw,46px); line-height:1.08; margin:0 0 10px; letter-spacing:-.02em; }
  h1 .hl { background:linear-gradient(transparent 58%, var(--yellow) 58%, var(--yellow) 92%, transparent 92%); }
  h1 .accent { color:var(--brand); }
  h2 { font-family:var(--serif); font-size:24px; margin:34px 0 4px; letter-spacing:-.01em; display:flex; align-items:center; gap:10px; }
  h2 .num { font-family:-apple-system, "Segoe UI", Roboto, sans-serif; font-size:11px; background:var(--brand); color:#fff; border-radius:4px; padding:2px 6px; letter-spacing:.04em; }
  h2::after { content:""; } section > h2 + * { margin-top:14px; }
  section h2 { border-bottom:none; } section { position:relative; }
  section .rule { display:block; width:46px; height:4px; background:var(--yellow); margin:0 0 12px; }
  h3 { font-size:12px; letter-spacing:.1em; text-transform:uppercase; margin:18px 0 6px; }
  p { margin:0 0 8px; }
  .muted { color:var(--muted); }
  .callout { background:var(--soft); border-left:4px solid var(--brand); border-radius:6px; padding:14px 16px; }
  .card { border:1.5px solid var(--ink); border-radius:8px; padding:12px 14px; margin:0 0 12px; background:#fff; box-shadow:4px 4px 0 var(--ink); }
  .row { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:4px; }
  .pill { font-size:10px; text-transform:uppercase; font-weight:800; letter-spacing:.06em; color:#fff; padding:2px 8px; border-radius:4px; background:var(--muted); }
  .pill.active { background:var(--ok); } .pill.likely { background:var(--blue); } .pill.absent { background:var(--bad); }
  .stats { display:flex; flex-wrap:wrap; gap:28px; margin:18px 0; } .stats b { display:block; font-family:var(--serif); font-size:34px; color:var(--brand); line-height:1; } .stats span { font-size:12px; color:var(--muted); }
  dl { display:grid; grid-template-columns:minmax(110px, 170px) 1fr; gap:6px 14px; margin:6px 0; }
  dt { font-weight:700; color:var(--muted); font-size:11px; letter-spacing:.08em; text-transform:uppercase; padding-top:2px; } dd { margin:0; }
  ul { list-style:none; margin:4px 0 8px; padding-left:0; } ul li { position:relative; padding-left:18px; margin-bottom:5px; }
  ul li::before { content:""; position:absolute; left:0; top:.55em; width:7px; height:7px; background:var(--brand); }
  ol { margin:4px 0 8px; padding-left:20px; } ol li { margin-bottom:4px; }
  .tw { overflow-x:auto; margin:8px 0 14px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; background:var(--ink); color:#fff; padding:7px 8px; font-size:12px; } td { border-bottom:1px solid var(--line); padding:7px 8px; vertical-align:top; }
  tr:nth-child(even) td { background:var(--paper); } td:first-child { font-weight:700; }
  .part { margin-top:40px; padding:22px; background:var(--ink); color:#fff; border-radius:10px; }
  .part .kicker { color:var(--yellow); border-color:var(--yellow); } .part h1 { color:#fff; font-size:30px; } .part .muted { color:#d9d3c7; }
  .upsell { margin-top:30px; background:var(--ink); color:#fff; border-radius:10px; padding:22px; border-left:none; }
  .upsell h2 { margin-top:0; color:#fff; } .upsell a { display:inline-block; margin-top:6px; background:var(--brand); color:#fff; padding:10px 16px; border-radius:8px; font-weight:800; text-decoration:none; }
  .toc { border:1.5px solid var(--ink); border-radius:8px; padding:16px 18px; margin:0 0 10px; background:var(--paper); }
  .toc h3 { color:var(--brand); margin:12px 0 4px; } .toc ol { list-style:none; padding:0; margin:0; columns:2; column-gap:24px; }
  .toc li { break-inside:avoid; margin:0 0 3px; } .toc a { color:var(--ink); text-decoration:none; } .toc a:hover { color:var(--brand); }
  .toc .tnum { display:inline-block; min-width:26px; font-weight:800; color:var(--brand); font-size:12px; }
  @media (max-width:600px) { .toc ol { columns:1; } }
  footer { color:var(--muted); font-size:12px; margin-top:30px; border-top:1.5px solid var(--ink); padding-top:10px; }
  @media (max-width:600px) { dl { grid-template-columns:1fr; } dt { margin-top:6px; } main { box-shadow:4px 4px 0 var(--ink); } }
  @page { size:A4; margin:14mm 13mm; }
  @media print {
    body { background:#fff; font-size:11.5px; } .bar { display:none; } main { max-width:none; margin:0; padding:0; border:0; box-shadow:none; }
    .card, tr, dl, .callout { break-inside:avoid; } h2, h3 { break-after:avoid; } .part { break-before:page; }
    a { color:inherit; text-decoration:none; } .tw { overflow:visible; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style></head>
<body>
<div class="bar"><span><span class="mark"></span><b>Marketing Scholars</b> <small>${esc(title)}</small></span><span><small>Choose "Save as PDF" as the printer</small> <button onclick="window.print()">Save as PDF</button></span></div>
<main>
  <div class="cover">
    <p class="brand"><span class="mark"></span>Marketing <b>Scholars</b></p>
    <p class="kicker">${r.plan ? "FULL REPORT" : "FREE TEARDOWN"}</p>
    ${
      r.plan
        ? `<h1>${esc(r.plan.brandName)} <span class="muted">vs</span> ${esc(d.competitor)}<br><span class="hl">Their strategy, reverse-engineered.</span> <span class="accent">Your plan, built from it.</span></h1>`
        : `<h1>${esc(d.competitor)}'s marketing strategy, <span class="hl">reverse-engineered.</span> <span class="accent">Study it. Then build yours.</span></h1>`
    }
    <div class="stats">
      <div><b>${d.channels.filter((c) => c.status === "active" || c.status === "likely").length}</b><span>channels mapped</span></div>
      <div><b>${d.whatWorks.length}</b><span>tactics scored</span></div>
      <div><b>${d.gaps.length}</b><span>blind spots found</span></div>
      ${r.plan ? `<div><b>90</b><span>day plan for you</span></div>` : ""}
    </div>
    ${kv([
      ["Competitor", d.url],
      ["Your brand", r.plan ? (r.plan.domain ? `${r.plan.brandName} (${r.plan.domain})` : `${r.plan.brandName} (fresh start, no website yet)`) : ""],
      ["Generated", date],
      ["Analysis engine", d.engine],
    ])}
  </div>
  ${tocHtml()}
  ${teardownBody}
  ${r.plan ? planBody : upsell}
  <footer>Method: public pages only (homepage, pricing, blog, robots.txt, sitemap, llms.txt). Observations are labelled; inferences are marked as such. Traffic and spend are never stated as numbers. Copy the mechanism, never the material. Marketing Scholars, ${esc(date)}.</footer>
</main>
</body></html>`;
}
