"use client";

import { useEffect, useRef, useState } from "react";
import type { Report, Tier } from "@/lib/types";

const STEPS = [
  "Reading the homepage",
  "Mapping sitemap, robots.txt and llms.txt",
  "Reading pricing and blog pages",
  "Detecting tech stack, pixels and email tools",
  "Reverse engineering positioning and funnel",
  "Scoring what transfers and finding gaps",
];
const PRO_STEPS = [...STEPS, "Reading your site", "Building strategies and channel plan", "Writing 30/60/90 plan and content calendar", "Writing SEO, ads, email and swipe file"];

export default function Home() {
  const [tier, setTier] = useState<Tier>("free");
  const [form, setForm] = useState({ competitorUrl: "", brandName: "", domain: "", niche: "", audience: "", goal: "", accessCode: "" });
  const [cfg, setCfg] = useState<{ proFreeBeta: boolean; aiEnabled: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({ proFreeBeta: true, aiEnabled: false }));
  }, []);

  const steps = tier === "pro" ? PRO_STEPS : STEPS;
  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), tier === "pro" ? 6000 : 3500);
    return () => clearInterval(id);
  }, [loading, steps.length, tier]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setReport(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!report) return;
    setPdfBusy(true);
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
      if (!res.ok) throw new Error("Could not build the PDF.");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "marketing-report.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  function upgrade() {
    setTier("pro");
    setReport(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const t = report?.teardown;
  return (
    <main className="wrap">
      <header className="top">
        <div className="logo">Market<span>Mirror</span></div>
        <span className="badge">{cfg?.proFreeBeta ? "Beta: full report free" : "Beta"}</span>
      </header>

      <section className="hero">
        <h1>See exactly how your competitor markets. Then beat it.</h1>
        <p>Paste a competitor URL. We reverse engineer their positioning, channels, SEO, funnel and offer into a PDF teardown. Add your brand and get a full marketing plan built from it.</p>
      </section>

      <form className="card" onSubmit={submit}>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={tier === "free"} onClick={() => setTier("free")}>
            <b>Free teardown</b>
            <small>Competitor's reverse-engineered marketing, PDF</small>
          </button>
          <button type="button" role="tab" className="tab" aria-selected={tier === "pro"} onClick={() => setTier("pro")}>
            <b>Full plan {cfg?.proFreeBeta ? "(free in beta)" : "(Pro)"}</b>
            <small>Teardown plus your end-to-end marketing plan</small>
          </button>
        </div>

        <label htmlFor="competitorUrl">Competitor website</label>
        <input id="competitorUrl" required placeholder="competitor.com" value={form.competitorUrl} onChange={set("competitorUrl")} inputMode="url" autoComplete="off" />

        {tier === "pro" && (
          <>
            <div className="grid2">
              <div>
                <label htmlFor="brandName">Your brand name</label>
                <input id="brandName" required placeholder="Acme" value={form.brandName} onChange={set("brandName")} />
              </div>
              <div>
                <label htmlFor="domain">Your domain</label>
                <input id="domain" required placeholder="acme.com" value={form.domain} onChange={set("domain")} inputMode="url" />
              </div>
              <div>
                <label htmlFor="niche">What you sell <span className="opt">(optional)</span></label>
                <input id="niche" placeholder="Email marketing software for creators" value={form.niche} onChange={set("niche")} />
              </div>
              <div>
                <label htmlFor="audience">Who you sell to <span className="opt">(optional)</span></label>
                <input id="audience" placeholder="Solo coaches in the US" value={form.audience} onChange={set("audience")} />
              </div>
            </div>
            <label htmlFor="goal">Main goal for the next 90 days <span className="opt">(optional)</span></label>
            <input id="goal" placeholder="Get 200 trial signups a month" value={form.goal} onChange={set("goal")} />
            {cfg && !cfg.proFreeBeta && (
              <>
                <label htmlFor="accessCode">Access code</label>
                <input id="accessCode" required value={form.accessCode} onChange={set("accessCode")} />
              </>
            )}
          </>
        )}

        <button className="btn full" disabled={loading}>
          {loading ? "Analysing…" : tier === "pro" ? "Build my marketing plan" : "Reverse engineer their marketing"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
        {loading && (
          <ul className="steps" aria-live="polite">
            {steps.map((s, i) => (
              <li key={s} className={i < step ? "done" : i === step ? "now" : ""}>{s}</li>
            ))}
          </ul>
        )}
        {cfg && !cfg.aiEnabled && <p className="note">AI is not configured on this server, so reports use the rule-based engine (observations only).</p>}
      </form>

      {t && report && (
        <div className="result card" ref={resultRef}>
          <h2>{report.plan ? `${report.plan.brandName} vs ${t.competitor}` : t.competitor}</h2>
          <p className="note" style={{ marginTop: 0 }}>{t.url} · {t.generatedAt.slice(0, 10)} · {t.engine}</p>
          <div className="summary">{t.summary}</div>

          <h3>Channel map</h3>
          <div className="chips">
            {t.channels.map((c) => (
              <span key={c.channel} className={`chip ${c.status}`} title={c.evidence}>{c.channel}</span>
            ))}
          </div>

          <h3>Positioning</h3>
          <p style={{ margin: 0 }}><b>{t.positioning.oneLiner}</b></p>
          <p className="note">Primary CTA: {t.positioning.primaryCta || "n/a"} · Entry offer: {t.funnel.entryOffer || "n/a"}</p>

          <h3>What works for them</h3>
          <div className="scroll">
            <table>
              <thead><tr><th>Tactic</th><th>Transfers?</th></tr></thead>
              <tbody>
                {t.whatWorks.map((w) => (
                  <tr key={w.tactic}><td>{w.tactic}<div className="note" style={{ marginTop: 2 }}>{w.whyItWorks}</div></td><td>{w.transferable}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Their blind spots</h3>
          <ul>{t.gaps.slice(0, 6).map((g) => <li key={g}>{g}</li>)}</ul>

          {report.plan && (
            <>
              <h3>Your positioning</h3>
              <div className="summary">{report.plan.positioning.statement}</div>
              <h3>First 30 days</h3>
              <ul>{report.plan.executionPlan[0]?.tasks.map((x) => <li key={x.task}>{x.task} <span className="note">({x.hours}h)</span></li>)}</ul>
              <p className="note">The PDF includes strategies, channel plan, full 30/60/90 plan, content pillars, a 12-week calendar, SEO keywords, ad angles, email sequence, swipe file and KPIs.</p>
            </>
          )}

          <div className="actions">
            <button className="btn" onClick={downloadPdf} disabled={pdfBusy}>{pdfBusy ? "Building PDF…" : "Download PDF report"}</button>
            {!report.plan && <button className="btn ghost" onClick={upgrade}>Get my full marketing plan</button>}
          </div>

          {!report.plan && (
            <div className="upsell">
              <b>Want the plan, not just the teardown?</b>
              <p className="note">Add your brand and domain. We will turn {t.competitor}&apos;s playbook into your positioning, strategies, 30/60/90 execution plan, content calendar, SEO keywords, ad angles and email sequence.</p>
            </div>
          )}
        </div>
      )}

      <section className="how">
        <div><b>1. Footprint</b><p>We read their public homepage, pricing, blog, sitemap, robots.txt and llms.txt, and detect pixels, email and analytics tools.</p></div>
        <div><b>2. Teardown</b><p>AI reverse engineers positioning, audience, channels, content, SEO, funnel and offer, and marks what transfers to you.</p></div>
        <div><b>3. Your plan</b><p>Strategies, a 30/60/90 plan with kill rules, a 12-week content calendar, SEO, ads and email. Mechanisms, never their material.</p></div>
      </section>

      <footer>
        Public pages only. We never state traffic or ad spend as numbers because they cannot be observed from outside. Copy the mechanism, never the material.
      </footer>
    </main>
  );
}
