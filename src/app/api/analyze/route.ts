import { NextResponse } from "next/server";
import { z } from "zod";
import { validAccessCode } from "@/lib/access";
import { analyze } from "@/lib/analyze";
import { alreadyEmailed, paidFromProof, proGate, webhookConfigured, type PaidOrder } from "@/lib/billing";
import { emailPaidReportOnce, emailReport } from "@/lib/deliver";
import { emailConfigured } from "@/lib/email";
import { validateBrand } from "@/lib/brandInput";
import { rateLimit } from "@/lib/rateLimit";
import { FetchBlockedError, normalizeUrl } from "@/lib/safeFetch";

export const runtime = "nodejs";
export const maxDuration = 60;

const field = (max: number) => z.string().trim().max(max).optional();
const Body = z.object({
  competitorUrl: z.string().trim().max(300).default(""),
  tier: z.enum(["free", "pro"]).default("free"),
  stage: z.enum(["existing", "new"]).optional(),
  brandName: field(80),
  domain: field(200),
  niche: field(160),
  audience: field(200),
  goal: field(200),
  location: field(80),
  budget: field(80),
  accessCode: field(100),
  payment: z.object({ orderId: z.string().max(60), paymentId: z.string().max(60), signature: z.string().max(128) }).optional(),
  email: z.string().trim().max(200).optional(),
});

const EmailSchema = z.string().email();

type Delivery = { status: "sent" | "already" | "pending" | "failed" | "none"; to?: string };

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid competitor URL." }, { status: 400 });
  let b = parsed.data;
  let paid: PaidOrder | null = null;

  // A paid Razorpay order carries its own inputs; they override anything sent.
  if (b.payment) {
    if (proGate() !== "razorpay") return NextResponse.json({ error: "Payments are not enabled." }, { status: 400 });
    paid = await paidFromProof(b.payment);
    if (!paid) return NextResponse.json({ error: "We could not confirm that payment, or it is more than 7 days old.", code: "PAYWALL" }, { status: 402 });
    b = { ...b, ...paid.inputs, tier: "pro" };
  }

  // Unpaid reports are emailed to the address given; the free teardown requires one when email is set up.
  const email = b.email ? b.email.toLowerCase() : "";
  if (!paid) {
    if (email && !EmailSchema.safeParse(email).success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (b.tier === "free" && emailConfigured() && !email) return NextResponse.json({ error: "Enter your email and we will send you the PDF." }, { status: 400 });
  }
  if (b.competitorUrl.length < 3) return NextResponse.json({ error: "Please enter a valid competitor URL." }, { status: 400 });

  try {
    normalizeUrl(b.competitorUrl);
  } catch (e) {
    const msg = e instanceof FetchBlockedError ? e.message : "That does not look like a valid public URL.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const checked = b.tier === "pro" ? validateBrand(b) : null;
  if (checked && "error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const brand = checked && "brand" in checked ? checked.brand : undefined;

  if (b.tier === "pro" && !paid && proGate() !== "free" && !validAccessCode(b.accessCode)) {
    return NextResponse.json(
      { error: proGate() === "razorpay" ? "The full report needs payment." : "The full report needs a valid access code.", code: "PAYWALL" },
      { status: 402 },
    );
  }

  // Paying customers are limited per purchase, not per network.
  const rl = paid ? rateLimit(`payment:${paid.paymentId}`, 5) : rateLimit(clientIp(req));
  const emailRl = !paid && email ? rateLimit(`email:${email}`, 3) : { ok: true, retryAfterSec: 0 };
  if (!emailRl.ok) return NextResponse.json({ error: "Too many reports sent to that email. Try again later." }, { status: 429 });
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many reports from your network. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  }

  try {
    const report = await analyze({
      competitorUrl: b.competitorUrl,
      tier: b.tier,
      brand,
    });
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
