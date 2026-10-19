import type { Report } from "./types";

// Report delivery by email through Resend (free tier: 3,000 emails a month).
// The PDF goes out as an attachment with a short HTML summary in the body.

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

function apiBase(): string {
  // RESEND_API_BASE points at a local mock in tests; ignored in production.
  return process.env.NODE_ENV !== "production" && process.env.RESEND_API_BASE ? process.env.RESEND_API_BASE.replace(/\/$/, "") : "https://api.resend.com";
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function reportEmail(r: Report, appUrl: string): { subject: string; html: string; text: string } {
  const t = r.teardown;
  const pro = r.tier === "pro" && r.plan;
  const subject = pro
    ? `Your marketing plan: ${r.plan!.brandName} vs ${t.competitor}`
    : `${t.competitor}'s marketing, reverse engineered`;
  const gaps = t.gaps.slice(0, 3);
  const first = pro ? r.plan!.executionPlan[0]?.tasks.slice(0, 3).map((x) => x.task) ?? [] : [];
  const li = (xs: string[]) => xs.map((x) => `<li style="margin:0 0 6px">${esc(x)}</li>`).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f7f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14161f">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  <p style="font-weight:800;font-size:17px;margin:0 0 20px">Marketing <span style="color:#ff4d2e">Scholars</span></p>
  <div style="background:#fff;border:1px solid #e3e5eb;border-radius:12px;padding:24px">
    <h1 style="font-size:21px;line-height:1.3;margin:0 0 12px">${esc(subject)}</h1>
    <p style="margin:0 0 16px;line-height:1.55">Your ${pro ? "full report" : "teardown"} is attached as a PDF.</p>
    <div style="background:#eef0ff;border-radius:8px;padding:14px;line-height:1.55;margin:0 0 16px">${esc(t.summary.slice(0, 600))}${t.summary.length > 600 ? "…" : ""}</div>
    ${gaps.length ? `<p style="font-weight:700;margin:0 0 6px">Their biggest blind spots</p><ul style="padding-left:18px;margin:0 0 16px;line-height:1.5">${li(gaps)}</ul>` : ""}
    ${first.length ? `<p style="font-weight:700;margin:0 0 6px">Your first moves</p><ul style="padding-left:18px;margin:0 0 16px;line-height:1.5">${li(first)}</ul>` : ""}
    ${
      pro
        ? ""
        : `<p style="margin:16px 0 0;line-height:1.55"><b>Want the plan, not just the teardown?</b> Get positioning, a 30/60/90 plan, a 12-week content calendar, SEO keywords, ad angles and an email sequence for your brand.</p>
    <p style="margin:14px 0 0"><a href="${esc(appUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:8px">Get my full marketing plan</a></p>`
    }
  </div>
  <p style="font-size:12px;color:#5b6070;line-height:1.5;margin:16px 4px 0">You received this because this address was entered on Marketing Scholars to receive a report. Built from public pages only. Copy the mechanism, never the material.</p>
</div></body></html>`;

  const text = `${subject}\n\nYour ${pro ? "full report" : "teardown"} is attached as a PDF.\n\n${t.summary}\n${
    gaps.length ? `\nTheir biggest blind spots:\n${gaps.map((g) => `- ${g}`).join("\n")}\n` : ""
  }${pro ? "" : `\nGet your full marketing plan: ${appUrl}\n`}`;
  return { subject, html, text };
}

export async function sendReportEmail(to: string, r: Report, pdf: Buffer, appUrl: string): Promise<void> {
  const { subject, html, text } = reportEmail(r, appUrl);
  const slug = r.teardown.competitor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "competitor";
  const res = await fetch(`${apiBase()}/emails`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      reply_to: process.env.EMAIL_REPLY_TO || undefined,
      subject,
      html,
      text,
      attachments: [{ filename: `${slug}-${r.tier === "pro" ? "full-plan" : "teardown"}.pdf`, content: pdf.toString("base64") }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
