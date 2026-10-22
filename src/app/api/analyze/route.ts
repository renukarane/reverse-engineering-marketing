import { after, NextResponse } from "next/server";
import { z } from "zod";
import { validAccessCode } from "@/lib/access";
import { isAdmin } from "@/lib/admin";
import { analyze } from "@/lib/analyze";
import { alreadyEmailed, paidFromProof, proGate, webhookConfigured, type PaidOrder } from "@/lib/billing";
import { emailPaidReportOnce, emailReport, fulfilPaidOrder } from "@/lib/deliver";
import { emailConfigured } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { checkReportInput, clientIp, EmailSchema, ReportFields } from "@/lib/reportInput";
import { confirmFlowOn, paidStatus } from "@/lib/requests";
import { FetchBlockedError } from "@/lib/safeFetch";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = ReportFields.extend({
  payment: z.object({ orderId: z.string().max(60), paymentId: z.string().max(60), signature: z.string().max(128) }).optional(),
});

type Delivery = { status: "sent" | "already" | "pending" | "failed" | "none"; to?: string };

// Builds a report and returns it as JSON. Who can see it:
// - the admin, always (for testing; nothing is emailed);
// - everyone, until Supabase and email are set up (the original on-page flow).
// Once they are, visitors use /api/request and get the report by email only, and
// a paid order handed in here is built and emailed in the background.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid competitor URL." }, { status: 400 });
  let b = parsed.data;
  const admin = isAdmin(req);
  const emailFirst = confirmFlowOn() && !admin;
  let paid: PaidOrder | null = null;

  // A paid Razorpay order carries its own inputs; they override anything sent.
  if (b.payment) {
    if (proGate() !== "razorpay") return NextResponse.json({ error: "Payments are not enabled." }, { status: 400 });
    paid = await paidFromProof(b.payment);
    if (!paid) return NextResponse.json({ error: "We could not confirm that payment, or it is more than 7 days old.", code: "PAYWALL" }, { status: 402 });
    b = { ...b, ...paid.inputs, tier: "pro" };
    if (emailFirst) {
      if (!paid.email) return NextResponse.json({ error: "We have your payment but no email to send the report to. Please contact support." }, { status: 400 });
      const rl = rateLimit(`payment:${paid.paymentId}`, 10);
      if (!rl.ok) return NextResponse.json({ error: "Please wait a few minutes and try again." }, { status: 429 });
      const status = await paidStatus(paid.orderId);
      const order = paid;
      const origin = new URL(req.url).origin;
      if (status !== "sent") after(() => fulfilPaidOrder(order, origin).catch((e) => console.error("[analyze] paid fulfilment failed:", e)));
      return NextResponse.json({ delivery: { status: status === "sent" ? "already" : "pending", to: paid.email } satisfies Delivery });
    }
  }

  if (emailFirst) return NextResponse.json({ error: "Reports are sent by email. Please refresh the page and try again." }, { status: 403 });

  // Unpaid reports are emailed to the address given; the free teardown requires one when email is set up.
  const email = b.email && !admin ? b.email.toLowerCase() : "";
  if (!paid && !admin) {
    if (email && !EmailSchema.safeParse(email).success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (b.tier === "free" && emailConfigured() && !email) return NextResponse.json({ error: "Enter your email and we will send you the PDF." }, { status: 400 });
  }

  const checked = checkReportInput(b);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  if (b.tier === "pro" && !paid && !admin && proGate() !== "free" && !validAccessCode(b.accessCode)) {
    return NextResponse.json(
      { error: proGate() === "razorpay" ? "The full report needs payment." : "The full report needs a valid access code.", code: "PAYWALL" },
      { status: 402 },
    );
  }

  if (!admin) {
    // Paying customers are limited per purchase, not per network.
    const rl = paid ? rateLimit(`payment:${paid.paymentId}`, 5) : rateLimit(clientIp(req));
    const emailRl = !paid && email ? rateLimit(`email:${email}`, 3) : { ok: true, retryAfterSec: 0 };
    if (!emailRl.ok) return NextResponse.json({ error: "Too many reports sent to that email. Try again later." }, { status: 429 });
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many reports from your network. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
    }
  }

  try {
    const report = await analyze({ competitorUrl: b.competitorUrl, tier: checked.tier, brand: checked.brand });
    const origin = new URL(req.url).origin;
    let delivery: Delivery = { status: "none" };
    if (paid) {
      // With a webhook configured, the webhook emails the paid report the moment
      // payment completes (even if this tab was closed), so a fresh return only shows
      // it. Later rebuilds send it themselves if the webhook never managed to.
      const webhookOwnsIt = webhookConfigured() && Date.now() / 1000 - paid.created < 300;
      if (paid.email && webhookOwnsIt) delivery = { status: (await alreadyEmailed(paid.paymentId)) ? "already" : "pending", to: paid.email };
      else if (paid.email) delivery = { status: await emailPaidReportOnce(paid, report, origin), to: paid.email };
    } else if (email && emailConfigured()) {
      delivery = { status: (await emailReport(email, report, origin)) ? "sent" : "failed", to: email };
    }
    return NextResponse.json({ ...report, delivery });
  } catch (e) {
    console.error("[analyze]", e);
    const msg = e instanceof FetchBlockedError ? e.message : "We could not read that website. Check the URL, or the site may block automated visitors.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
