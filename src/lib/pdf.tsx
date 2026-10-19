import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { CompetitorTeardown, ProPlan, Report } from "./types";

// Built-in Helvetica only (no network font fetch). It covers WinAnsi, so anything
// outside Latin-1 plus common punctuation is transliterated or dropped.
function t(s: string | number | undefined | null): string {
  return String(s ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/₹/g, "INR ")
    .replace(/\xAD/g, "") // soft hyphens from web copy confuse line breaking
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€]/g, "");
}

// No dictionary hyphenation; long unbroken tokens (URLs, slugs) may break every 20 chars.
Font.registerHyphenationCallback((word) => (word.length > 20 ? word.match(/.{1,20}/g) ?? [word] : [word]));

const C = { ink: "#14161f", muted: "#5b6070", line: "#e3e5eb", brand: "#4f46e5", soft: "#eef0ff", ok: "#0f766e", warn: "#b45309", bad: "#b91c1c" };

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontFamily: "Helvetica", fontSize: 9.5, color: C.ink, lineHeight: 1.45 },
  cover: { padding: 56, fontFamily: "Helvetica", color: C.ink, backgroundColor: "#f7f7fb" },
  kicker: { fontSize: 9, letterSpacing: 2, color: C.brand, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h1: { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 8, lineHeight: 1.2 },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 8, color: C.brand },
  h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 6 },
  muted: { color: C.muted },
  small: { fontSize: 8, color: C.muted },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 10, marginBottom: 8 },
  softCard: { backgroundColor: C.soft, borderRadius: 4, padding: 12, marginBottom: 10 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 4 },
  th: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: C.ink, paddingBottom: 4, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  dot: { width: 10, color: C.brand },
  kv: { flexDirection: "row", marginBottom: 4 },
  k: { width: 120, fontFamily: "Helvetica-Bold", color: C.muted, fontSize: 8.5 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
  pill: { fontSize: 7.5, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3, color: "#fff", alignSelf: "flex-start" },
});

const Bullets = ({ items }: { items: string[] }) =>
  items.length ? (
    <View>
      {items.map((x, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.dot}>•</Text>
          <Text style={{ flex: 1 }}>{t(x)}</Text>
        </View>
      ))}
    </View>
  ) : (
    <Text style={s.muted}>Not detected.</Text>
  );

const KV = ({ k, v }: { k: string; v: string }) =>
  v ? (
    <View style={s.kv} wrap={false}>
      <Text style={s.k}>{t(k)}</Text>
      <Text style={{ flex: 1 }}>{t(v)}</Text>
    </View>
  ) : null;

function Table({ cols, rows }: { cols: { label: string; w: number }[]; rows: string[][] }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={s.th} wrap={false}>
        {cols.map((c, i) => (
          <Text key={i} style={{ flex: c.w, paddingRight: 6 }}>{t(c.label)}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.row} wrap={false}>
          {r.map((cell, ci) => (
            <Text key={ci} style={{ flex: cols[ci].w, paddingRight: 6, fontSize: 8.5 }}>{t(cell)}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const statusColor = (st: string) => (st === "active" ? C.ok : st === "likely" ? C.brand : st === "absent" ? C.bad : C.muted);

function Footer({ label }: { label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{t(label)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.h2}>{t(title)}</Text>
      {children}
    </View>
  );
}

function TeardownPages({ d, footer }: { d: CompetitorTeardown; footer: string }) {
  return (
    <>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="1. Executive summary">
          <View style={s.softCard}><Text>{t(d.summary)}</Text></View>
        </Section>
        <Section title="2. Positioning">
          <KV k="One-liner" v={d.positioning.oneLiner} />
          <KV k="Target audience" v={d.positioning.targetAudience} />
          <KV k="Awareness stage" v={d.positioning.awarenessStage} />
          <KV k="Sophistication" v={d.positioning.sophisticationStage} />
          <KV k="Core offer" v={d.positioning.coreOffer} />
          <KV k="Primary CTA" v={d.positioning.primaryCta} />
        </Section>
        <Section title="3. Audience">
          <Text style={s.h3}>Segments</Text>
          <Bullets items={d.audience.segments} />
          <Text style={s.h3}>Pains they address</Text>
          <Bullets items={d.audience.painsAddressed} />
          <Text style={s.h3}>Objections they handle</Text>
          <Bullets items={d.audience.objectionsHandled} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="4. Channel map">
          {d.channels.map((c, i) => (
            <View key={i} style={s.card} wrap={false}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(c.channel)}</Text>
                <Text style={[s.pill, { backgroundColor: statusColor(c.status) }]}>{c.status.toUpperCase()}</Text>
              </View>
              <Text>{t(c.evidence)}</Text>
              {c.role ? <Text style={s.small}>{t(c.role)}</Text> : null}
            </View>
          ))}
        </Section>
        <Section title="5. Content engine">
          <KV k="Cadence" v={d.content.cadence} />
          <KV k="CTA pattern" v={d.content.ctaPattern} />
          <KV k="Hook style" v={d.content.hookStyle} />
          <Text style={s.h3}>Pillars</Text>
          <Bullets items={d.content.pillars} />
          <Text style={s.h3}>Formats</Text>
          <Bullets items={d.content.formats} />
        </Section>
        <Section title="6. SEO footprint">
          <Text style={s.h3}>Page types</Text>
          <Bullets items={d.seo.pageTypes} />
          <Text style={s.h3}>Programmatic patterns</Text>
          <Bullets items={d.seo.programmatic} />
          <Text style={s.h3}>Keyword themes</Text>
          <Bullets items={d.seo.keywordThemes} />
          <Text style={s.h3}>Observations</Text>
          <Bullets items={d.seo.observations} />
        </Section>
        <Section title="7. Funnel and offer">
          <KV k="Entry offer" v={d.funnel.entryOffer} />
          <KV k="Core offer" v={d.funnel.coreOffer} />
          <KV k="Pricing model" v={d.funnel.pricingModel} />
          <KV k="Upgrade gate" v={d.funnel.upgradeGate} />
          <Text style={s.h3}>Funnel steps</Text>
          {d.funnel.steps.map((x, i) => (
            <Text key={i} style={s.p}>{`${i + 1}. ${t(x)}`}</Text>
          ))}
          <Text style={s.h3}>Tech stack detected</Text>
          <Text>{t(d.techStack.join(", ") || "None detected")}</Text>
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="8. What works for them, and whether it transfers">
          <Table
            cols={[{ label: "Tactic (mechanism)", w: 3 }, { label: "Evidence", w: 3 }, { label: "Why it works", w: 3 }, { label: "Transfer", w: 1.2 }, { label: "Cost to copy", w: 1.6 }]}
            rows={d.whatWorks.map((w) => [w.tactic, w.evidence, w.whyItWorks, w.transferable, w.costToCopy])}
          />
        </Section>
        <Section title="9. Gaps: their blind spots">
          <Bullets items={d.gaps} />
        </Section>
        <Section title="10. Quick wins for a smaller rival">
          <Bullets items={d.quickWins} />
        </Section>
      </Page>
    </>
  );
}

function PlanPages({ p, comp, footer }: { p: ProPlan; comp: string; footer: string }) {
  return (
    <>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Text style={s.kicker}>PART TWO</Text>
        <Text style={[s.h1, { fontSize: 20 }]}>{t(`${p.brandName}: end-to-end marketing plan`)}</Text>
        <Text style={[s.muted, { marginBottom: 12 }]}>{t(`Built from the reverse-engineered playbook of ${comp}.`)}</Text>
        <Section title="A. Executive summary">
          <View style={s.softCard}><Text>{t(p.executiveSummary)}</Text></View>
        </Section>
        <Section title="B. Positioning">
          <View style={s.card}><Text style={{ fontFamily: "Helvetica-Bold" }}>{t(p.positioning.statement)}</Text></View>
          <Text style={s.h3}>Differentiators</Text>
          <Bullets items={p.positioning.differentiators} />
          <Text style={s.h3}>Messaging pillars</Text>
          <Bullets items={p.positioning.messagingPillars} />
          <Text style={s.h3}>Tagline options</Text>
          <Bullets items={p.positioning.taglines} />
        </Section>
        <Section title="C. Ideal customer">
          <KV k="Primary" v={p.icp.primary} />
          <KV k="Secondary" v={p.icp.secondary} />
          <Text style={s.h3}>Pains</Text>
          <Bullets items={p.icp.pains} />
          <Text style={s.h3}>Buying triggers</Text>
          <Bullets items={p.icp.triggers} />
          <Text style={s.h3}>Where they gather</Text>
          <Bullets items={p.icp.whereTheyGather} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="D. Strategies">
          {p.strategies.map((x, i) => (
            <View key={i} style={s.card} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>{t(`${i + 1}. ${x.name}`)}</Text>
              <KV k="Objective" v={x.objective} />
              <KV k="Borrowed mechanism" v={x.borrowedMechanism} />
              <KV k="Our twist" v={x.ourTwist} />
              <KV k="Why it will work" v={x.whyItWillWork} />
            </View>
          ))}
        </Section>
        <Section title="E. Channel plan">
          <Table
            cols={[{ label: "Channel", w: 1.6 }, { label: "Pri", w: 0.6 }, { label: "Goal", w: 2.2 }, { label: "Tactics", w: 3.4 }, { label: "KPI", w: 1.6 }, { label: "Effort", w: 1.3 }]}
            rows={p.channelPlan.map((c) => [c.channel, c.priority, c.goal, c.tactics.join("; "), c.kpi, c.effort])}
          />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="F. 30 / 60 / 90 day execution plan">
          {p.executionPlan.map((ph, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={s.h3}>{t(`${ph.phase}: ${ph.focus}`)}</Text>
              <Table
                cols={[{ label: "Task", w: 3.5 }, { label: "Hours", w: 0.8 }, { label: "Metric", w: 2 }, { label: "Kill rule", w: 2.4 }]}
                rows={ph.tasks.map((x) => [x.task, x.hours, x.metric, x.killRule])}
              />
            </View>
          ))}
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="G. Content plan">
          {p.contentPlan.pillars.map((pl, i) => (
            <View key={i} style={s.card} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(pl.name)}</Text>
              <Text style={[s.small, { marginBottom: 4 }]}>{t(pl.purpose)}</Text>
              <Bullets items={pl.topics} />
            </View>
          ))}
          <Text style={s.h3}>12-week content calendar</Text>
          <Table
            cols={[{ label: "Wk", w: 0.5 }, { label: "Title", w: 4 }, { label: "Format", w: 1.2 }, { label: "Channel", w: 1.5 }, { label: "Stage", w: 0.8 }, { label: "Keyword", w: 2 }]}
            rows={p.contentPlan.calendar.map((c) => [String(c.week), c.title, c.format, c.channel, c.funnelStage, c.keyword])}
          />
          <Text style={s.h3}>Repurposing chain (one asset, many derivatives)</Text>
          <Bullets items={p.contentPlan.repurposingChain} />
          <Text style={s.h3}>Article skeleton</Text>
          <Bullets items={p.contentPlan.template} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="H. SEO plan">
          <Table cols={[{ label: "Keyword", w: 3 }, { label: "Intent", w: 1.5 }, { label: "Page type", w: 2 }]} rows={p.seoPlan.keywords.map((k) => [k.keyword, k.intent, k.pageType])} />
          <Text style={s.h3}>Page types to build</Text>
          <Bullets items={p.seoPlan.pageTypesToBuild} />
          <KV k="Programmatic idea" v={p.seoPlan.programmaticIdea} />
        </Section>
        <Section title="I. Paid ads plan">
          <Table cols={[{ label: "Angle", w: 1.4 }, { label: "Hook", w: 3.2 }, { label: "Offer", w: 1.8 }, { label: "Format", w: 1.3 }]} rows={p.adsPlan.angles.map((a) => [a.angle, a.hook, a.offer, a.format])} />
          <KV k="Budget guidance" v={p.adsPlan.budgetGuidance} />
        </Section>
        <Section title="J. Email plan">
          <KV k="Lead magnet" v={p.emailPlan.leadMagnet} />
          <Table cols={[{ label: "Day", w: 0.6 }, { label: "Subject", w: 3.5 }, { label: "Goal", w: 2.5 }]} rows={p.emailPlan.sequence.map((e) => [String(e.day), e.subject, e.goal])} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="K. Swipe file (mechanisms, not material)">
          {p.swipeFile.map((w, i) => (
            <View key={i} style={s.card} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>{t(w.mechanism)}</Text>
              <KV k="Why it works" v={w.whyItWorks} />
              <KV k="Blank version" v={w.blankVersion} />
              <KV k="Your version" v={w.yourVersion} />
            </View>
          ))}
        </Section>
        <Section title="L. Gaps to exploit">
          <Bullets items={p.gapsToExploit} />
        </Section>
        <Section title="M. KPIs">
          <Table cols={[{ label: "Metric", w: 3 }, { label: "Day 30", w: 2 }, { label: "Day 90", w: 2 }]} rows={p.kpis.map((k) => [k.metric, k.target30, k.target90])} />
        </Section>
        <Section title="N. Risks and honest caveats">
          <Bullets items={p.risks} />
        </Section>
      </Page>
    </>
  );
}

function UpgradePage({ footer, url }: { footer: string; url: string }) {
  return (
    <Page size="A4" style={s.page}>
      <Footer label={footer} />
      <View style={[s.softCard, { padding: 24, marginTop: 40 }]}>
        <Text style={s.kicker}>FULL REPORT</Text>
        <Text style={[s.h1, { fontSize: 20 }]}>Turn this teardown into your own marketing plan</Text>
        <Text style={s.p}>The full report takes everything above and builds an end-to-end plan for your brand:</Text>
        <Bullets
          items={[
            "Positioning statement, differentiators and tagline options",
            "Ideal customer, buying triggers and where they gather",
            "4 to 6 strategies built on mechanisms borrowed from this competitor",
            "Prioritised channel plan with KPIs and effort",
            "30 / 60 / 90 day execution plan with hours and kill rules",
            "Content pillars, a 12-week content calendar and an article skeleton",
            "SEO keyword plan, ad angles, a 6-email welcome sequence",
            "Swipe file of mechanisms rewritten for your brand",
          ]}
        />
        <Text style={[s.p, { marginTop: 10, fontFamily: "Helvetica-Bold" }]}>{t(`Get it at ${url}`)}</Text>
      </View>
    </Page>
  );
}

async function renderDesignedPdf(r: Report, appUrl: string): Promise<Buffer> {
  const d = r.teardown;
  const date = d.generatedAt.slice(0, 10);
  const footer = `Marketing Scholars · ${d.competitor} · ${date}`;
  const doc = (
    <Document title={`${d.competitor} marketing teardown`} author="Marketing Scholars" subject="Reverse-engineered marketing plan">
      <Page size="A4" style={s.cover}>
        <View style={{ marginTop: 120 }}>
          <Text style={s.kicker}>{r.tier === "pro" ? "FULL REPORT" : "FREE TEARDOWN"}</Text>
          <Text style={[s.h1, { fontSize: 32 }]}>{t(r.plan ? `${r.plan.brandName} vs ${d.competitor}` : d.competitor)}</Text>
          <Text style={{ fontSize: 14, color: C.muted, marginBottom: 30 }}>
            {r.plan ? "Reverse-engineered competitor teardown and your end-to-end marketing plan" : "Reverse-engineered marketing teardown"}
          </Text>
          <KV k="Competitor" v={d.url} />
          {r.plan ? <KV k="Your brand" v={`${r.plan.brandName} (${r.plan.domain})`} /> : null}
          <KV k="Generated" v={date} />
          <KV k="Analysis engine" v={d.engine} />
        </View>
        <View style={{ position: "absolute", bottom: 56, left: 56, right: 56 }}>
          <Text style={s.small}>
            Method: public pages only (homepage, pricing, blog, robots.txt, sitemap, llms.txt). Observations are labelled; inferences are marked as such.
            Traffic and spend are never stated as numbers because they cannot be observed from outside. Copy the mechanism, never the material.
            This research decays in weeks; re-run it quarterly.
          </Text>
        </View>
      </Page>
      <TeardownPages d={d} footer={footer} />
      {r.plan ? <PlanPages p={r.plan} comp={d.competitor} footer={footer} /> : <UpgradePage footer={footer} url={appUrl} />}
    </Document>
  );
  return renderToBuffer(doc);
}

/** Every section as a plain heading plus lines, for the fallback layout. */
function plainSections(r: Report, appUrl: string): { h: string; lines: string[] }[] {
  const d = r.teardown;
  const p = r.plan;
  const list = (xs: string[]) => xs.map((x) => `- ${x}`);
  const kv = (o: Record<string, string>) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const out: { h: string; lines: string[] }[] = [
    { h: "Summary", lines: [d.summary] },
    { h: "Positioning", lines: kv(d.positioning) },
    { h: "Audience", lines: [...list(d.audience.segments), ...list(d.audience.painsAddressed), ...list(d.audience.objectionsHandled)] },
    { h: "Channels", lines: d.channels.map((c) => `- ${c.channel} [${c.status}]: ${c.evidence} ${c.role}`) },
    { h: "Content", lines: [...kv({ cadence: d.content.cadence, ctaPattern: d.content.ctaPattern, hookStyle: d.content.hookStyle }), ...list(d.content.pillars), ...list(d.content.formats)] },
    { h: "SEO", lines: [...list(d.seo.pageTypes), ...list(d.seo.programmatic), ...list(d.seo.keywordThemes), ...list(d.seo.observations)] },
    { h: "Funnel and offer", lines: [...kv({ entryOffer: d.funnel.entryOffer, coreOffer: d.funnel.coreOffer, pricingModel: d.funnel.pricingModel, upgradeGate: d.funnel.upgradeGate }), ...list(d.funnel.steps)] },
    { h: "Tech stack", lines: [d.techStack.join(", ")] },
    { h: "What works for them", lines: d.whatWorks.map((w) => `- ${w.tactic} (${w.transferable}, ${w.costToCopy}): ${w.whyItWorks} Evidence: ${w.evidence}`) },
    { h: "Their blind spots", lines: list(d.gaps) },
    { h: "Quick wins", lines: list(d.quickWins) },
  ];
  if (p) {
    out.push(
      { h: `Your plan: ${p.brandName}`, lines: [p.executiveSummary] },
      { h: "Positioning", lines: [p.positioning.statement, ...list(p.positioning.differentiators), ...list(p.positioning.taglines)] },
      { h: "Ideal customer", lines: [p.icp.primary, p.icp.secondary, ...list(p.icp.pains), ...list(p.icp.triggers), ...list(p.icp.whereTheyGather)] },
      { h: "Strategies", lines: p.strategies.map((x) => `- ${x.name}: ${x.objective}. Borrowed: ${x.borrowedMechanism}. Our twist: ${x.ourTwist}`) },
      { h: "Channel plan", lines: p.channelPlan.map((c) => `- ${c.channel} (${c.priority}): ${c.goal}. ${c.tactics.join("; ")}. KPI: ${c.kpi}`) },
      { h: "30/60/90 plan", lines: p.executionPlan.flatMap((ph) => [`${ph.phase}: ${ph.focus}`, ...ph.tasks.map((x) => `- ${x.task} (${x.hours}h). Metric: ${x.metric}. Kill rule: ${x.killRule}`)]) },
      { h: "Content plan", lines: [...p.contentPlan.pillars.flatMap((pl) => [`${pl.name}: ${pl.purpose}`, ...list(pl.topics)]), ...p.contentPlan.calendar.map((c) => `Week ${c.week}: ${c.title} (${c.format}, ${c.channel}, ${c.funnelStage})`)] },
      { h: "SEO plan", lines: [...p.seoPlan.keywords.map((k) => `- ${k.keyword} (${k.intent}, ${k.pageType})`), p.seoPlan.programmaticIdea] },
      { h: "Ads plan", lines: [...p.adsPlan.angles.map((a) => `- ${a.angle}: ${a.hook} Offer: ${a.offer}`), p.adsPlan.budgetGuidance] },
      { h: "Email plan", lines: [p.emailPlan.leadMagnet, ...p.emailPlan.sequence.map((e) => `- Day ${e.day}: ${e.subject} (${e.goal})`)] },
      { h: "Swipe file", lines: p.swipeFile.map((w) => `- ${w.mechanism}. Blank: ${w.blankVersion}. Yours: ${w.yourVersion}`) },
      { h: "KPIs", lines: p.kpis.map((k) => `- ${k.metric}: day 30 ${k.target30}, day 90 ${k.target90}`) },
      { h: "Risks", lines: list(p.risks) },
    );
  } else {
    out.push({ h: "Get your full marketing plan", lines: [appUrl] });
  }
  return out.map((x) => ({ h: x.h, lines: x.lines.filter(Boolean) })).filter((x) => x.lines.length);
}

// ASCII only, for the fallback layout.
const ascii = (s: string) => t(s).normalize("NFKD").replace(/[^\x0A\x20-\x7E]/g, "");

/** Fallback layout: plain text only, no tables, cards or fixed footers. */
function renderPlainPdf(r: Report, appUrl: string): Promise<Buffer> {
  const d = r.teardown;
  return renderToBuffer(
    <Document title={ascii(`${d.competitor} marketing teardown`)} author="Marketing Scholars">
      <Page size="A4" style={{ padding: 40, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4 }}>
        <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 6 }}>{ascii(r.plan ? `${r.plan.brandName} vs ${d.competitor}` : d.competitor)}</Text>
        <Text style={{ color: "#5b6070", marginBottom: 14 }}>{ascii(`${d.url} | ${d.generatedAt.slice(0, 10)} | ${d.engine}`)}</Text>
        {plainSections(r, appUrl).map((sec, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: "#4f46e5", marginBottom: 4 }}>{ascii(sec.h)}</Text>
            {sec.lines.map((l, j) => (
              <Text key={j} style={{ marginBottom: 3 }}>{ascii(l)}</Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>,
  );
}

/** Designed PDF, falling back to the plain layout if the designed one fails to render. */
export async function renderReportPdf(r: Report, appUrl: string): Promise<Buffer> {
  try {
    // PDF_FORCE_PLAIN exercises the fallback in local tests; ignored in production.
    if (process.env.PDF_FORCE_PLAIN === "true" && process.env.NODE_ENV !== "production") throw new Error("PDF_FORCE_PLAIN");
    return await renderDesignedPdf(r, appUrl);
  } catch (e) {
    console.error("[pdf] designed layout failed, using plain layout:", e);
    return renderPlainPdf(r, appUrl);
  }
}
