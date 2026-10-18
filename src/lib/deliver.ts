import { analyze } from "./analyze";
import { alreadyEmailed, markEmailed, type PaidSession } from "./billing";
import { emailConfigured, sendReportEmail } from "./email";
import { renderReportPdf } from "./pdf";
import type { Report } from "./types";

export function appUrl(fallbackOrigin?: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin || "http://localhost:3000";
}

/** Renders the PDF and emails it. Never throws: returns whether it was sent. */
export async function emailReport(to: string, report: Report, origin?: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const url = appUrl(origin);
    const pdf = await renderReportPdf(report, url);
    await sendReportEmail(to, report, pdf, url);
    return true;
  } catch (e) {
    console.error("[deliver] email failed:", (e as Error).message);
    return false;
  }
}

// Payments being built or emailed by this server instance right now. Stops
// concurrent webhook deliveries and page loads from doing the same work twice.
const inFlight = new Set<string>();

/** Paid path: email a paid report once per payment, whoever gets there first. */
export async function emailPaidReportOnce(paid: PaidSession, report: Report, origin?: string): Promise<"sent" | "already" | "failed"> {
  if (!paid.email) return "failed";
  const key = paid.paymentIntentId ?? paid.email;
  if (inFlight.has(`send:${key}`)) return "already";
  inFlight.add(`send:${key}`);
  try {
    if (await alreadyEmailed(paid.paymentIntentId)) return "already";
    // Claim before sending so another instance that checks next sees it; release on failure.
    await markEmailed(paid.paymentIntentId);
    const sent = await emailReport(paid.email, report, origin);
    if (!sent) await markEmailed(paid.paymentIntentId, "");
    return sent ? "sent" : "failed";
  } finally {
    inFlight.delete(`send:${key}`);
  }
}

/** Webhook path: build the paid report from the session and email it. */
export async function fulfilPaidSession(paid: PaidSession): Promise<void> {
  if (!paid.email) return;
  const key = `build:${paid.paymentIntentId ?? paid.email}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    if (await alreadyEmailed(paid.paymentIntentId)) return;
    const report = await analyze({ competitorUrl: paid.inputs.competitorUrl, tier: "pro", brand: paid.inputs });
    await emailPaidReportOnce(paid, report);
  } finally {
    inFlight.delete(key);
  }
}
