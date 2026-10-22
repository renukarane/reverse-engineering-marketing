"use client";

import { useCallback, useEffect, useState } from "react";
import { downloadReportPdf, openReportHtml } from "@/lib/reportClient";
import type { Report } from "@/lib/types";

interface Row {
  id: string;
  created_at: string;
  email: string;
  tier: "free" | "pro";
  inputs: { competitorUrl: string; stage?: string; brandName?: string; domain?: string; niche?: string };
  status: string;
  sent_at: string | null;
  engine: string | null;
  error: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  awaiting_confirmation: "Waiting for email confirm",
  awaiting_payment: "Not paid",
  building: "Building",
  sent: "Sent",
  failed: "Failed",
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

export default function AdminPanel() {
  const [auth, setAuth] = useState<{ admin: boolean; configured: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/login").then((r) => r.json()).then(setAuth).catch(() => setAuth({ admin: false, configured: false }));
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || "Could not sign in.");
    setPassword("");
    setAuth({ admin: true, configured: true });
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuth({ admin: false, configured: true });
  }

  if (!auth) return <p className="note">Loading…</p>;
  if (!auth.admin) {
    return (
      <form className="card" style={{ maxWidth: 420, margin: "40px auto" }} onSubmit={login}>
        <p className="brandmark">Marketing <span>Scholars</span> admin</p>
        {!auth.configured && <p className="error">Set ADMIN_PASSWORD (8 or more characters) in Vercel, then redeploy.</p>}
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn full">Sign in</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    );
  }

  return (
    <>
      <div className="admin-head">
        <h1>Marketing <span style={{ color: "#ff4d2e" }}>Scholars</span> admin</h1>
        <button className="btn ghost sm" onClick={logout}>Sign out</button>
      </div>
      <TestReport />
      <Requests />
    </>
  );
}

// Builds a report and shows it here. Nothing is emailed or saved.
function TestReport() {
  const [f, setF] = useState({ competitorUrl: "", tier: "free", stage: "existing", brandName: "", domain: "", niche: "", audience: "", location: "", goal: "" });
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const pro = f.tier === "pro";
  const fresh = f.stage === "new";

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setReport(null);
    setBusy(true);
    const started = Date.now();
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      setReport({ ...d, _ms: Date.now() - started } as Report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pdf() {
    if (!report) return;
    setPdfBusy(true);
    setError("");
    try {
      await downloadReportPdf(report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  const ms = (report as unknown as { _ms?: number } | null)?._ms;
  return (
    <form className="card" onSubmit={run}>
      <h2>Test a report</h2>
      <p className="note" style={{ marginTop: 0 }}>Paste a competitor link to view the report here. Nothing is emailed or saved.</p>
      <div className="grid2">
        <div>
          <label htmlFor="a-url">Competitor website</label>
          <input id="a-url" required placeholder="competitor.com" value={f.competitorUrl} onChange={set("competitorUrl")} />
        </div>
        <div>
          <label htmlFor="a-tier">Report</label>
          <select id="a-tier" value={f.tier} onChange={set("tier")}>
            <option value="free">Free teardown</option>
            <option value="pro">Full plan</option>
          </select>
        </div>
        {pro && (
          <>
            <div>
              <label htmlFor="a-stage">Scenario</label>
              <select id="a-stage" value={f.stage} onChange={set("stage")}>
                <option value="existing">Has a website</option>
                <option value="new">Starting fresh</option>
              </select>
            </div>
            <div>
              <label htmlFor="a-brand">Brand name {fresh && <span className="opt">(optional)</span>}</label>
              <input id="a-brand" required={!fresh} value={f.brandName} onChange={set("brandName")} />
            </div>
            {!fresh && (
              <div>
                <label htmlFor="a-domain">Their website</label>
                <input id="a-domain" required value={f.domain} onChange={set("domain")} />
              </div>
            )}
            <div>
              <label htmlFor="a-niche">What they sell {!fresh && <span className="opt">(optional)</span>}</label>
              <input id="a-niche" required={fresh} value={f.niche} onChange={set("niche")} />
            </div>
            <div>
              <label htmlFor="a-aud">Who they sell to {!fresh && <span className="opt">(optional)</span>}</label>
              <input id="a-aud" required={fresh} value={f.audience} onChange={set("audience")} />
            </div>
            {fresh && (
              <div>
                <label htmlFor="a-loc">City <span className="opt">(optional)</span></label>
                <input id="a-loc" value={f.location} onChange={set("location")} />
              </div>
            )}
          </>
        )}
      </div>
      <button className="btn full" disabled={busy}>{busy ? "Building… (up to a minute)" : "Build report"}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {report && (
        <div style={{ marginTop: 18 }}>
          <h2>{report.plan ? `${report.plan.brandName || "New brand"} vs ${report.teardown.competitor}` : report.teardown.competitor}</h2>
          <p className="note" style={{ marginTop: 0 }}>
            Engine: {report.teardown.engine}
            {ms ? ` · ${(ms / 1000).toFixed(0)}s` : ""}
          </p>
          <p style={{ lineHeight: 1.55 }}>{report.teardown.summary}</p>
          <div className="row-actions">
            <button type="button" className="btn" onClick={pdf} disabled={pdfBusy}>{pdfBusy ? "Building PDF…" : "Download PDF"}</button>
            <button type="button" className="btn ghost" onClick={() => openReportHtml(report)}>View report</button>
          </div>
        </div>
      )}
    </form>
  );
}

// Every report anyone asked for, newest first.
function Requests() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [db, setDb] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/requests", { cache: "no-store" });
      const d = await res.json();
      setDb(d.db !== false);
      setRows(d.rows ?? []);
      if (d.error) setError(d.error);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resend(id: string, rebuild: boolean) {
    setMsg("");
    const res = await fetch("/api/admin/resend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, rebuild }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Sending. Refresh in a minute to see the status." : d.error || "Could not resend.");
    load();
  }

  const counts = (rows ?? []).reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
  return (
    <div className="card">
      <div className="admin-head" style={{ marginBottom: 8 }}>
        <h2>Requests</h2>
        <button className="btn ghost sm" onClick={load}>Refresh</button>
      </div>
      {!db && <p className="error">Supabase is not connected. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.</p>}
      {rows && rows.length > 0 && (
        <p className="note" style={{ marginTop: 0 }}>
          Last {rows.length}: {Object.entries(counts).map(([k, v]) => `${STATUS_LABEL[k] ?? k} ${v}`).join(" · ")}
        </p>
      )}
      {msg && <p className="note" role="status">{msg}</p>}
      {error && <p className="error">{error}</p>}
      {rows === null ? (
        <p className="note">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="note">No requests yet.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr><th>When</th><th>Email</th><th>Report</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{when(r.created_at)}</td>
                  <td>{r.email}</td>
                  <td>
                    {r.inputs.competitorUrl}
                    <small>
                      {r.tier === "pro"
                        ? `Full plan · ${r.inputs.stage === "new" ? `fresh start${r.inputs.niche ? `: ${r.inputs.niche}` : ""}` : `${r.inputs.brandName ?? ""} (${r.inputs.domain ?? ""})`}`
                        : "Free teardown"}
                    </small>
                  </td>
                  <td>
                    <span className={`pill ${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    {r.sent_at && <small>{when(r.sent_at)}{r.engine ? ` · ${r.engine}` : ""}</small>}
                    {r.error && <small title={r.error}>{r.error.slice(0, 80)}</small>}
                  </td>
                  <td>
                    <div className="row-actions">
                      {r.status === "sent" && <a className="btn ghost sm" href={`/api/admin/pdf?id=${r.id}`} target="_blank" rel="noopener">PDF</a>}
                      {r.status === "sent" && <button className="btn ghost sm" onClick={() => resend(r.id, false)}>Resend</button>}
                      {r.status !== "building" && <button className="btn ghost sm" onClick={() => resend(r.id, true)}>{r.status === "sent" ? "Rebuild" : "Build & send"}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
