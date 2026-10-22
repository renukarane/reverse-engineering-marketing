import { createHash, randomBytes } from "node:crypto";
import type { PaidOrder } from "./billing";
import { validateBrand } from "./brandInput";
import { claim, dbConfigured, ensureOrderRow, getByOrderId, getByTokenHash, insertRequest, updateRequest, type ReportInputs, type ReportRequest } from "./db";
import { emailConfigured, sendConfirmEmail, sendReportEmail } from "./email";
import type { Report, Tier } from "./types";

// Email-first delivery. Nobody sees a report on the page: free and unpaid reports
// wait until the visitor clicks the link we email them, then the PDF is built and
// emailed. Paid reports are built and emailed as soon as payment is confirmed.
// Only the admin can view a report in the browser.

const CONFIRM_TTL_MS = 24 * 3600_000;

/** On once Supabase and Resend are both set up; until then reports show on the page as before. */
export function confirmFlowOn(): boolean {
  return dbConfigured() && emailConfigured();
}

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(user.length - 2, 6)))}@${domain}`;
}

const competitorLabel = (url: string) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 60);
  }
};

/** Saves the request and emails a confirmation link. The token itself is never stored. */
export async function createRequest(p: { email: string; tier: Tier; inputs: ReportInputs; ip: string; appUrl: string }): Promise<ReportRequest> {
  const token = randomBytes(24).toString("base64url");
  const row = await insertRequest({ email: p.email, tier: p.tier, inputs: p.inputs, status: "awaiting_confirmation", token_hash: hashToken(token), ip: p.ip });
  try {
    await sendConfirmEmail(p.email, competitorLabel(p.inputs.competitorUrl), p.tier, `${p.appUrl}/confirm?token=${token}`);
  } catch (e) {
    await updateRequest(row.id, { status: "failed", error: `confirm email: ${(e as Error).message}`.slice(0, 500) }).catch(() => {});
    throw e;
  }
  return row;
}

export type ConfirmResult =
  | { status: "building"; row: ReportRequest }
  | { status: "already"; to: string; sent: boolean }
  | { status: "expired" | "invalid" };

/** Marks the email confirmed and claims the request for building, exactly once. */
export async function confirmRequest(token: string): Promise<ConfirmResult> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { status: "invalid" };
  const found = await getByTokenHash(hashToken(token));
  if (!found) return { status: "invalid" };
  if (found.status !== "awaiting_confirmation") return { status: "already", to: maskEmail(found.email), sent: found.status === "sent" };
  if (Date.now() - Date.parse(found.created_at) > CONFIRM_TTL_MS) return { status: "expired" };
  const row = await claim(`id=eq.${found.id}`, ["awaiting_confirmation"], { confirmed_at: new Date().toISOString() });
  return row ? { status: "building", row } : { status: "already", to: maskEmail(found.email), sent: false };
}

/**
 * Builds the report for a claimed row (or reuses the stored one), emails the PDF,
 * and records the outcome. Never throws.
 */
export async function buildAndSend(row: ReportRequest, appUrl: string, opts: { reuse?: Report | null } = {}): Promise<boolean> {
  try {
    // Loaded on demand: the PDF renderer is heavy and only needed here.
    const [{ analyze }, { renderReportPdf }] = await Promise.all([import("./analyze"), import("./pdf")]);
    let report = opts.reuse ?? null;
    if (!report) {
      const checked = row.tier === "pro" ? validateBrand(row.inputs) : null;
      if (checked && "error" in checked) throw new Error(checked.error);
      report = await analyze({ competitorUrl: row.inputs.competitorUrl, tier: row.tier, brand: checked && "brand" in checked ? checked.brand : undefined });
    }
    const pdf = await renderReportPdf(report, appUrl);
    await sendReportEmail(row.email, report, pdf, appUrl);
    await updateRequest(row.id, { status: "sent", sent_at: new Date().toISOString(), engine: report.teardown.engine.slice(0, 80), report, error: null });
    return true;
  } catch (e) {
    console.error("[requests] build/send failed:", (e as Error).message);
    await updateRequest(row.id, { status: "failed", error: (e as Error).message.slice(0, 500) }).catch((err) => console.error("[requests] could not record failure:", err));
    return false;
  }
}

/** Paid path with a database: one row per order, claimed by whoever arrives first. */
export async function fulfilPaidWithDb(paid: PaidOrder, appUrl: string): Promise<"building" | "already" | "failed"> {
  if (!paid.email) return "failed";
  const { competitorUrl, ...brand } = paid.inputs;
  await ensureOrderRow({ email: paid.email, tier: "pro", inputs: { competitorUrl, ...brand }, status: "awaiting_payment", order_id: paid.orderId, payment_id: paid.paymentId });
  const row = await claim(`order_id=eq.${encodeURIComponent(paid.orderId)}`, ["awaiting_payment", "failed"], { payment_id: paid.paymentId, email: paid.email });
  if (!row) return "already";
  return (await buildAndSend(row, appUrl)) ? "building" : "failed";
}

/** What the buyer's page shows after paying. */
export async function paidStatus(orderId: string): Promise<"sent" | "pending"> {
  const row = await getByOrderId(orderId).catch(() => null);
  return row?.status === "sent" ? "sent" : "pending";
}
