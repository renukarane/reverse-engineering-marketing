"use client";

import { useEffect, useRef, useState } from "react";
import { reportHtml } from "@/lib/reportHtml";
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

type Proof = { orderId: string; paymentId: string; signature: string };
type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, f: (r: unknown) => void) => void };

// Razorpay Checkout runs as a modal from their script; loaded only when someone pays.
function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Payment window failed to load.")));
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

export default function Home() {
  const [tier, setTier] = useState<Tier>("free");
  const [form, setForm] = useState({ competitorUrl: "", brandName: "", domain: "", niche: "", audience: "", goal: "", accessCode: "", email: "" });
  const [cfg, setCfg] = useState<{ proFreeBeta: boolean; proGate: "free" | "razorpay" | "code"; price: string; aiEnabled: boolean; emailEnabled: boolean } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [notice, setNotice] = useState("");
  const [paidProof, setPaidProof] = useState<Proof | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [report, setReport] = useState<(Report & { delivery?: { status: string; to?: string } }) | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({ proFreeBeta: true, proGate: "free", price: "", aiEnabled: false, emailEnabled: false }));
    // A payment from the last few days lets the buyer rebuild their report.
    try {
      const saved = localStorage.getItem("mm_paid_order");
      if (saved) setPaidProof(JSON.parse(saved));
    } catch {
      /* storage blocked or corrupt */
    }
  }, []);

  const steps = tier === "pro" ? PRO_STEPS : STEPS;
  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), tier === "pro" ? 6000 : 3500);
    return () => clearInterval(id);
  }, [loading, steps.length, tier]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const needsCheckout = tier === "pro" && cfg?.proGate === "razorpay" && !(showCode && form.accessCode);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (needsCheckout) return checkout();
    return run({ ...form, tier });
  }

  async function checkout() {
    setError("");
    setNotice("");
    setPaying(true);
    try {
      const [Razorpay, res] = await Promise.all([
        loadRazorpay(),
        fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }),
      ]);
      const order = await res.json();
      if (!res.ok || !order.orderId) throw new Error(order.error || "Could not start payment.");
      const rzp = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: { email: order.email || undefined },
        theme: { color: "#4f46e5" },
        // UPI only: hide cards, netbanking and wallets.
        config: {
          display: {
            blocks: { upi: { name: "Pay with UPI", instruments: [{ method: "upi" }] } },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: false },
          },
        },
        handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const proof = { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature };
          try {
            localStorage.setItem("mm_paid_order", JSON.stringify(proof));
          } catch {
            /* storage blocked */
          }
          setPaying(false);
          run({ payment: proof, tier: "pro" });
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setNotice("Payment cancelled. You were not charged.");
          },
        },
      });
      rzp.on("payment.failed", () => setNotice("That UPI payment did not go through. You can try again."));
      rzp.open();
    } catch (err) {
      setError((err as Error).message);
      setPaying(false);
    }
  }

  async function run(payload: Record<string, unknown>) {
    setError("");
    setNotice("");
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (payload.payment) setPaidProof(null);
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
    setError("");
    setPdfBusy(true);
    // iPhone/iPad Safari ignores programmatic downloads and blocks pop-ups opened
    // after an await, so open the tab now, inside the click, and fill it in later.
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const tab = ios ? window.open("", "_blank") : null;
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Could not build the PDF (error ${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "marketing-report.pdf";
      if (tab) {
        tab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      // Revoking straight away cancels the download in Safari and Firefox.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setError(`PDF download failed: ${(err as Error).message} Use "View report (save as PDF)" instead.`);
    } finally {
      setPdfBusy(false);
    }
  }

  // Opens the printable HTML report in a new tab. Built synchronously in the
  // click, so pop-up blockers allow it, and it needs no server.
  function viewReport() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([reportHtml(report, window.location.origin)], { type: "text/html" }));
    const w = window.open(url, "_blank");
    if (!w) window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
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
            <b>Full plan {cfg?.proFreeBeta ? "(free in beta)" : cfg?.price ? `(${cfg.price})` : "(Pro)"}</b>
            <small>Teardown plus your end-to-end marketing plan</small>
          </button>
        </div>

        <label htmlFor="competitorUrl">Competitor website</label>
        <input id="competitorUrl" required placeholder="competitor.com" value={form.competitorUrl} onChange={set("competitorUrl")} inputMode="url" autoComplete="off" />

        {tier === "free" && cfg?.emailEnabled && (
          <>
            <label htmlFor="email">Your email <span className="opt">(we send the PDF here)</span></label>
            <input id="email" type="email" required placeholder="you@company.com" value={form.email} onChange={set("email")} autoComplete="email" />
          </>
        )}

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
                <input id="audience" placeholder="D2C founders in India" value={form.audience} onChange={set("audience")} />
              </div>
            </div>
            <label htmlFor="goal">Main goal for the next 90 days <span className="opt">(optional)</span></label>
            <input id="goal" placeholder="Get 200 paying customers a month" value={form.goal} onChange={set("goal")} />
            {(cfg?.emailEnabled || cfg?.proGate === "razorpay") && (
              <>
                <label htmlFor="email">
                  Your email <span className="opt">({cfg?.emailEnabled ? "we send the PDF here" : "for your receipt"})</span>
                </label>
                <input id="email" type="email" required={!!cfg?.emailEnabled} placeholder="you@company.com" value={form.email} onChange={set("email")} autoComplete="email" />
              </>
            )}
            {cfg?.proGate === "code" || showCode ? (
              <>
                <label htmlFor="accessCode">Access code</label>
                <input id="accessCode" required value={form.accessCode} onChange={set("accessCode")} />
              </>
            ) : cfg?.proGate === "razorpay" ? (
              <p className="note">
                <button type="button" className="linkish" onClick={() => setShowCode(true)}>Have an access code?</button>
              </p>
            ) : null}
          </>
        )}

        <button className="btn full" disabled={loading || paying}>
          {paying
            ? "Opening UPI payment…"
            : loading
              ? "Analysing…"
              : needsCheckout ? `Pay ${cfg?.price} with UPI` : tier === "pro" ? "Build my marketing plan" : "Reverse engineer their marketing"}
        </button>
        {needsCheckout && (
          <p className="note">
            One-time payment via UPI (Google Pay, PhonePe, Paytm, BHIM or any UPI app), secured by Razorpay.
            {cfg?.emailEnabled ? " Your PDF is also emailed to you the moment payment completes." : " Your report starts building right after payment."}
          </p>
        )}
        {notice && <p className="note" role="status">{notice}</p>}
        {paidProof && !loading && !report && (
          <p className="note">
            You have a paid report from the last 7 days.{" "}
            <button type="button" className="linkish" onClick={() => run({ payment: paidProof, tier: "pro" })}>Rebuild it</button>
          </p>
        )}
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
          {report.delivery?.to && report.delivery.status !== "none" && (
            <p className={report.delivery.status === "failed" ? "error" : "sent"} role="status">
              {report.delivery.status === "sent" && `📩 We emailed the PDF to ${report.delivery.to}.`}
              {report.delivery.status === "already" && `📩 We already emailed this PDF to ${report.delivery.to}.`}
              {report.delivery.status === "pending" && `📩 Your PDF is on its way to ${report.delivery.to}. It usually arrives within a minute or two.`}
              {report.delivery.status === "failed" && `We could not email ${report.delivery.to}. Use the download button below.`}
            </p>
          )}
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
            <button className="btn ghost" onClick={viewReport}>View report (save as PDF)</button>
            {!report.plan && <button className="btn ghost" onClick={upgrade}>Get my full marketing plan</button>}
          </div>

          {!report.plan && (
            <div className="upsell">
              <b>Want the plan, not just the teardown?</b>
              <p className="note">{cfg?.proGate === "razorpay" ? `One-time ${cfg.price} via UPI. ` : ""}Add your brand and domain. We will turn {t.competitor}&apos;s playbook into your positioning, strategies, 30/60/90 execution plan, content calendar, SEO keywords, ad angles and email sequence.</p>
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
