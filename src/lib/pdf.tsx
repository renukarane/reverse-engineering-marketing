import { Circle, Document, Font, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
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

// Brand palette, matching the landing page's editorial design.
const C = {
  ink: "#141210",
  muted: "#5d574e",
  line: "#e4ddcf",
  paper: "#f6f2ea",
  surface: "#fffdf8",
  brand: "#ff4d2e",
  yellow: "#ffc83d",
  blue: "#1b4dff",
  soft: "#fff1d6",
  ok: "#0f7a5c",
  bad: "#c62828",
};
const SERIF = "Times-Bold";

const s = StyleSheet.create({
  page: { paddingTop: 68, paddingLeft: 42, paddingRight: 42, paddingBottom: 58, fontFamily: "Helvetica", fontSize: 9.5, color: C.ink, lineHeight: 1.5, backgroundColor: C.surface },
  cover: { padding: 48, fontFamily: "Helvetica", color: C.ink, backgroundColor: C.paper },
  kicker: { fontSize: 8, letterSpacing: 1.6, color: C.brand, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h1: { fontSize: 30, fontFamily: SERIF, marginBottom: 8, lineHeight: 1.12 },
  h2: { fontSize: 19, fontFamily: SERIF, lineHeight: 1.15, color: C.ink },
  h3: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 5, letterSpacing: 0.8, color: C.ink },
  p: { marginBottom: 6 },
  muted: { color: C.muted },
  small: { fontSize: 8, color: C.muted },
  card: {
    borderWidth: 1.2,
    borderRightWidth: 3.5,
    borderBottomWidth: 3.5,
    borderColor: C.ink,
    borderRadius: 6,
    padding: 11,
    marginBottom: 9,
    backgroundColor: "#ffffff",
  },
  callout: { backgroundColor: C.soft, borderLeftWidth: 4, borderLeftColor: C.brand, borderRadius: 4, padding: 13, marginBottom: 10, fontSize: 10.5, lineHeight: 1.55 },
  row: { flexDirection: "row", borderBottomWidth: 0.8, borderBottomColor: C.line, paddingVertical: 5, paddingHorizontal: 5 },
  th: { flexDirection: "row", backgroundColor: C.ink, color: "#ffffff", paddingVertical: 5, paddingHorizontal: 5, fontFamily: "Helvetica-Bold", fontSize: 8, borderRadius: 3 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletMark: { width: 4.5, height: 4.5, backgroundColor: C.brand, marginTop: 4.2, marginRight: 7 },
  kv: { flexDirection: "row", marginBottom: 5 },
  k: { width: 112, fontFamily: "Helvetica-Bold", color: C.muted, fontSize: 7.5, letterSpacing: 0.6, paddingTop: 1.2 },
  header: { position: "absolute", top: 22, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1.2, borderBottomColor: C.ink },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", alignItems: "center", fontSize: 7.5, color: C.muted },
  pageNo: { color: C.ink, fontFamily: "Helvetica-Bold", fontSize: 8 },
  pill: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, color: "#fff", alignSelf: "flex-start" },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 3 },
});

/** The Marketing Scholars mark: a half-filled circle, as on the site. */
const Logo = ({ size = 16 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 20 20">
    <Circle cx="10" cy="10" r="8.6" fill={C.brand} stroke={C.ink} strokeWidth={1.6} />
    <Path d="M10 1.4 A8.6 8.6 0 0 0 10 18.6 Z" fill={C.ink} />
  </Svg>
);

const Wordmark = ({ size = 10 }: { size?: number }) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <Logo size={size + 5} />
    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: size, marginLeft: 5 }}>
      Marketing <Text style={{ color: C.brand }}>Scholars</Text>
    </Text>
  </View>
);

const Bullets = ({ items }: { items: string[] }) =>
  items.length ? (
    <View>
      {items.map((x, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <View style={s.bulletMark} />
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
      <Text style={s.k}>{t(k).toUpperCase()}</Text>
      <Text style={{ flex: 1 }}>{t(v)}</Text>
    </View>
  ) : null;

const SubHead = ({ children }: { children: string }) => (
  <Text style={s.h3} minPresenceAhead={30}>
    {t(children).toUpperCase()}
  </Text>
);

function Table({ cols, rows, heading }: { cols: { label: string; w: number }[]; rows: string[][]; heading?: ReactNode }) {
  const Row = ({ r, ri }: { r: string[]; ri: number }) => (
    <View style={[s.row, ri % 2 ? { backgroundColor: C.paper } : {}]} wrap={false}>
      {r.map((cell, ci) => (
        <Text key={ci} style={{ flex: cols[ci].w, paddingRight: 6, fontSize: 8.5, fontFamily: ci === 0 ? "Helvetica-Bold" : "Helvetica" }}>
          {t(cell)}
        </Text>
      ))}
    </View>
  );
  return (
    <View style={{ marginBottom: 10 }}>
      {/* Header and first row stay together so a header never ends a page alone. */}
      <View wrap={false}>
        {heading}
        <View style={s.th}>
          {cols.map((c, i) => (
            <Text key={i} style={{ flex: c.w, paddingRight: 6 }}>{t(c.label)}</Text>
          ))}
        </View>
        {rows[0] ? <Row r={rows[0]} ri={0} /> : null}
      </View>
      {rows.slice(1).map((r, i) => (
        <Row key={i + 1} r={r} ri={i + 1} />
      ))}
    </View>
  );
}

const statusColor = (st: string) => (st === "active" ? C.ok : st === "likely" ? C.blue : st === "absent" ? C.bad : C.muted);

/** Fixed header and footer on every content page. */
function Footer({ label }: { label: string }) {
  return (
    <>
      <View style={s.header} fixed>
        <Wordmark size={9} />
        <Text style={{ fontSize: 7.5, color: C.muted, letterSpacing: 0.6 }}>REVERSE-ENGINEER. THEN BUILD YOURS.</Text>
      </View>
      <View style={s.footer} fixed>
        <Text>{t(label)}</Text>
        {/* Plain text: a background box around a render-prop Text stretches to full page height. */}
        <Text style={s.pageNo} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

/** "3. Audience" renders as an orange "03" tag plus a serif heading with a yellow underline. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const m = title.match(/^([0-9A-Z]{1,2})\.\s+(.*)$/);
  const num = m ? (/^\d+$/.test(m[1]) ? m[1].padStart(2, "0") : m[1]) : "";
  const name = m ? m[2] : title;
  const heading = (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 2 }}>
        {num ? (
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8, color: "#ffffff", backgroundColor: C.brand, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginRight: 8, marginBottom: 3 }}>
            {num}
          </Text>
        ) : null}
        <Text style={s.h2}>{t(name)}</Text>
      </View>
      <View style={{ width: 46, height: 4, backgroundColor: C.yellow, marginBottom: 10 }} />
    </View>
  );
  const kids = Children.toArray(children);
  // A section that opens with a table carries its heading inside the table's
  // keep-together block, so the heading never ends a page on its own.
  if (isValidElement(kids[0]) && kids[0].type === Table) {
    return (
      <View style={{ marginBottom: 16 }}>
        {cloneElement(kids[0] as ReactElement<{ heading?: ReactNode }>, { heading })}
        {kids.slice(1)}
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 16 }}>
      <View wrap={false} minPresenceAhead={120}>
        {heading}
      </View>
      {kids}
    </View>
  );
}

function TeardownPages({ d, footer }: { d: CompetitorTeardown; footer: string }) {
  return (
    <>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="1. Executive summary">
          <View style={s.callout}><Text>{t(d.summary)}</Text></View>
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
          <SubHead>Segments</SubHead>
          <Bullets items={d.audience.segments} />
          <SubHead>Pains they address</SubHead>
          <Bullets items={d.audience.painsAddressed} />
          <SubHead>Objections they handle</SubHead>
          <Bullets items={d.audience.objectionsHandled} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="4. Channel map">
          {d.channels.map((c, i) => (
            <View key={i} style={s.card} wrap={false}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={s.cardTitle}>{t(c.channel)}</Text>
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
          <SubHead>Pillars</SubHead>
          <Bullets items={d.content.pillars} />
          <SubHead>Formats</SubHead>
          <Bullets items={d.content.formats} />
        </Section>
        <Section title="6. SEO footprint">
          <SubHead>Page types</SubHead>
          <Bullets items={d.seo.pageTypes} />
          <SubHead>Programmatic patterns</SubHead>
          <Bullets items={d.seo.programmatic} />
          <SubHead>Keyword themes</SubHead>
          <Bullets items={d.seo.keywordThemes} />
          <SubHead>Observations</SubHead>
          <Bullets items={d.seo.observations} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="7. Funnel and offer">
          <KV k="Entry offer" v={d.funnel.entryOffer} />
          <KV k="Core offer" v={d.funnel.coreOffer} />
          <KV k="Pricing model" v={d.funnel.pricingModel} />
          <KV k="Upgrade gate" v={d.funnel.upgradeGate} />
          <SubHead>Funnel steps</SubHead>
          {d.funnel.steps.map((x, i) => (
            <Text key={i} style={s.p}>{`${i + 1}. ${t(x)}`}</Text>
          ))}
          <SubHead>Tech stack detected</SubHead>
          <Text>{t(d.techStack.join(", ") || "None detected")}</Text>
        </Section>
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
        <View style={{ backgroundColor: C.ink, borderRadius: 8, padding: 20, marginBottom: 18 }}>
          <Text style={[s.kicker, { color: C.yellow }]}>PART TWO</Text>
          <Text style={[s.h1, { color: "#ffffff", fontSize: 24, marginBottom: 4 }]}>{t(`${p.brandName}: your marketing plan`)}</Text>
          <Text style={{ color: "#d9d3c7" }}>{t(`Built from what already works for ${comp}. Study it, then build yours.`)}</Text>
        </View>
        <Section title="A. Executive summary">
          <View style={s.callout}><Text>{t(p.executiveSummary)}</Text></View>
        </Section>
        <Section title="B. Positioning">
          <View style={s.card}><Text style={{ fontFamily: SERIF, fontSize: 13, lineHeight: 1.3 }}>{t(p.positioning.statement)}</Text></View>
          <SubHead>Differentiators</SubHead>
          <Bullets items={p.positioning.differentiators} />
          <SubHead>Messaging pillars</SubHead>
          <Bullets items={p.positioning.messagingPillars} />
          <SubHead>Tagline options</SubHead>
          <Bullets items={p.positioning.taglines} />
        </Section>
        <Section title="C. Ideal customer">
          <KV k="Primary" v={p.icp.primary} />
          <KV k="Secondary" v={p.icp.secondary} />
          <SubHead>Pains</SubHead>
          <Bullets items={p.icp.pains} />
          <SubHead>Buying triggers</SubHead>
          <Bullets items={p.icp.triggers} />
          <SubHead>Where they gather</SubHead>
          <Bullets items={p.icp.whereTheyGather} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="D. Strategies">
          {p.strategies.map((x, i) => (
            <View key={i} style={s.card} wrap={false}>
              <Text style={s.cardTitle}>{t(`${i + 1}. ${x.name}`)}</Text>
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
              <SubHead>{`${ph.phase}: ${ph.focus}`}</SubHead>
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
              <Text style={s.cardTitle}>{t(pl.name)}</Text>
              <Text style={[s.small, { marginBottom: 4 }]}>{t(pl.purpose)}</Text>
              <Bullets items={pl.topics} />
            </View>
          ))}
          <SubHead>12-week content calendar</SubHead>
          <Table
            cols={[{ label: "Wk", w: 0.5 }, { label: "Title", w: 4 }, { label: "Format", w: 1.2 }, { label: "Channel", w: 1.5 }, { label: "Stage", w: 0.8 }, { label: "Keyword", w: 2 }]}
            rows={p.contentPlan.calendar.map((c) => [String(c.week), c.title, c.format, c.channel, c.funnelStage, c.keyword])}
          />
          <SubHead>Repurposing chain (one asset, many derivatives)</SubHead>
          <Bullets items={p.contentPlan.repurposingChain} />
          <SubHead>Article skeleton</SubHead>
          <Bullets items={p.contentPlan.template} />
        </Section>
      </Page>
      <Page size="A4" style={s.page}>
        <Footer label={footer} />
        <Section title="H. SEO plan">
          <Table cols={[{ label: "Keyword", w: 3 }, { label: "Intent", w: 1.5 }, { label: "Page type", w: 2 }]} rows={p.seoPlan.keywords.map((k) => [k.keyword, k.intent, k.pageType])} />
          <SubHead>Page types to build</SubHead>
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
              <Text style={s.cardTitle}>{t(w.mechanism)}</Text>
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
      <View style={{ backgroundColor: C.ink, borderRadius: 10, padding: 28, marginTop: 30 }}>
        <Text style={[s.kicker, { color: C.yellow }]}>NEXT STEP</Text>
        <Text style={[s.h1, { color: "#ffffff", fontSize: 26 }]}>You&apos;ve studied their strategy. Now build yours.</Text>
        <Text style={{ color: "#d9d3c7", fontSize: 11, marginBottom: 14 }}>
          The full plan turns everything in this teardown into an end-to-end marketing plan for your brand:
        </Text>
        {[
          "Positioning statement, differentiators and tagline options",
          "Ideal customer, buying triggers and where they gather",
          "4 to 6 strategies built on what already works for this competitor",
          "Prioritised channel plan with KPIs and effort",
          "30 / 60 / 90 day plan with hours and stop rules",
          "Content pillars and a 12-week content calendar",
          "SEO keywords, ad angles and a 6-email welcome sequence",
          "Swipe file of their best mechanisms, rewritten for you",
        ].map((x) => (
          <View key={x} style={s.bullet}>
            <View style={[s.bulletMark, { backgroundColor: C.yellow }]} />
            <Text style={{ flex: 1, color: "#ffffff" }}>{x}</Text>
          </View>
        ))}
        <View style={{ marginTop: 16, backgroundColor: C.brand, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, alignSelf: "flex-start" }}>
          <Text style={{ color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>{t(`Build your plan at ${url.replace(/^https?:\/\//, "")}`)}</Text>
        </View>
      </View>
    </Page>
  );
}

// Names go on the cover in display type, so keep them to one or two lines.
const short = (x: string, n = 38) => (x.length > n ? `${x.slice(0, n - 1).trim()}...` : x);

function Cover({ r, date }: { r: Report; date: string }) {
  const d = r.teardown;
  const comp = short(d.competitor);
  const brand = r.plan ? short(r.plan.brandName, 24) : "";
  const big = (comp.length + brand.length > 30 ? 34 : 44);
  const active = d.channels.filter((c) => c.status === "active" || c.status === "likely").length;
  const stats: [string, string][] = [
    [String(active), "channels mapped"],
    [String(d.whatWorks.length), "tactics scored"],
    [String(d.gaps.length), "blind spots found"],
  ];
  if (r.plan) stats.push(["90", "day plan for you"]);
  return (
    <Page size="A4" style={s.cover}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={12} />
        <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1 }}>{date}</Text>
      </View>

      <View style={{ marginTop: 96 }}>
        <Text style={{ alignSelf: "flex-start", fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 1.6, color: C.brand, borderWidth: 1, borderColor: C.brand, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 16 }}>
          {r.plan ? "FULL REPORT" : "FREE TEARDOWN"}
        </Text>
        {r.plan ? (
          <Text style={[s.h1, { fontSize: big }]}>
            {t(brand)} <Text style={{ color: C.muted }}>vs</Text> {t(comp)}
          </Text>
        ) : (
          <Text style={[s.h1, { fontSize: big }]}>{t(`${comp}'s marketing strategy,`)}</Text>
        )}
        <Text style={[s.h1, { fontSize: r.plan ? 26 : big, marginTop: 2 }]}>
          <Text style={{ backgroundColor: C.yellow }}>{r.plan ? " Their strategy, reverse-engineered. " : " reverse-engineered. "}</Text>
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: r.plan ? 26 : 22, color: C.brand, marginTop: 6 }}>{r.plan ? "Your plan, built from it." : "Study it. Then build yours."}</Text>
      </View>

      <View style={{ flexDirection: "row", marginTop: 34 }}>
        {stats.map(([n, l]) => (
          <View key={l} style={{ marginRight: 30 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 30, color: C.brand }}>{n}</Text>
            <Text style={{ fontSize: 8.5, color: C.muted }}>{l}</Text>
          </View>
        ))}
      </View>

      <View style={[s.card, { marginTop: 30, backgroundColor: C.surface, padding: 14 }]}>
        <KV k="Competitor" v={d.url} />
        {r.plan ? <KV k="Your brand" v={`${r.plan.brandName} (${r.plan.domain})`} /> : null}
        <KV k="Generated" v={date} />
        <KV k="Analysis engine" v={d.engine} />
      </View>

      <View style={{ position: "absolute", bottom: 40, left: 48, right: 48, borderTopWidth: 1.2, borderTopColor: C.ink, paddingTop: 10 }}>
        <Text style={s.small}>
          Method: public pages only (homepage, pricing, blog, robots.txt, sitemap, llms.txt). Observations are labelled; inferences are marked as such. Traffic and spend are
          never stated as numbers because they cannot be observed from outside. Copy the mechanism, never the material. This research decays in weeks; re-run it quarterly.
        </Text>
      </View>
    </Page>
  );
}

async function renderDesignedPdf(r: Report, appUrl: string): Promise<Buffer> {
  const d = r.teardown;
  const date = d.generatedAt.slice(0, 10);
  const footer = `${d.competitor} · ${date}`;
  const doc = (
    <Document title={`${d.competitor} marketing teardown`} author="Marketing Scholars" subject="Reverse-engineered marketing strategy">
      <Cover r={r} date={date} />
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
