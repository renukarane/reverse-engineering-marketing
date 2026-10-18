import Stripe from "stripe";

// One-time Stripe Checkout per full report. No database: the report inputs ride in
// the Checkout Session's metadata, and the server re-reads the session from Stripe
// to confirm payment. A paid session can only ever regenerate the report it paid
// for, so reusing its id gains nothing.

export type ProGate = "free" | "stripe" | "code";

export interface ProInputs {
  competitorUrl: string;
  brandName: string;
  domain: string;
  niche?: string;
  audience?: string;
  goal?: string;
}

const SESSION_VALID_DAYS = 7;

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // STRIPE_API_BASE points the SDK at a local mock in tests; ignored in production.
  const base = process.env.NODE_ENV !== "production" && process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  client = new Stripe(key, {
    apiVersion: "2025-08-27.basil",
    appInfo: { name: "MarketMirror" },
    ...(base ? { host: base.hostname, port: Number(base.port), protocol: base.protocol.replace(":", "") as "http" | "https" } : {}),
  });
  return client;
}

export function proGate(): ProGate {
  const beta = process.env.PRO_FREE_BETA;
  // Free beta is the default only until Stripe is configured.
  if (beta === "true" || (beta === undefined && !process.env.STRIPE_SECRET_KEY)) return "free";
  return process.env.STRIPE_SECRET_KEY ? "stripe" : "code";
}

export function priceLabel(): string {
  const cents = Number(process.env.PRO_PRICE_CENTS) || 1900;
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

export async function createCheckout(inputs: ProInputs, origin: string, email?: string): Promise<string> {
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs)) if (v) metadata[k] = String(v).slice(0, 490);

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      process.env.STRIPE_PRICE_ID
        ? { price: process.env.STRIPE_PRICE_ID, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Number(process.env.PRO_PRICE_CENTS) || 1900,
              product_data: {
                name: "MarketMirror full marketing plan",
                description: `Competitor teardown plus end-to-end marketing plan for ${inputs.brandName}`.slice(0, 300),
              },
            },
          },
    ],
    metadata,
    customer_email: email || undefined,
    allow_promotion_codes: true,
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
    success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?canceled=1`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export interface PaidSession {
  inputs: ProInputs;
  email: string | null;
  paymentIntentId: string | null;
  /** Unix seconds when the Checkout Session was created. */
  created: number;
}

export function webhookConfigured(): boolean {
  return !!process.env.STRIPE_WEBHOOK_SECRET;
}

/** Validates a completed Checkout Session object (from retrieve or a webhook event). */
export function paidFromSession(session: Stripe.Checkout.Session): PaidSession | null {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return null;
  if (Date.now() / 1000 - session.created > SESSION_VALID_DAYS * 86400) return null;
  const m = session.metadata ?? {};
  if (!m.competitorUrl || !m.brandName || !m.domain) return null;
  const pi = session.payment_intent;
  return {
    inputs: { competitorUrl: m.competitorUrl, brandName: m.brandName, domain: m.domain, niche: m.niche, audience: m.audience, goal: m.goal },
    email: session.customer_details?.email ?? session.customer_email ?? null,
    paymentIntentId: typeof pi === "string" ? pi : pi?.id ?? null,
    created: session.created,
  };
}

/** Returns the paid session, or null if it is unpaid, expired or malformed. */
export async function paidSession(sessionId: string): Promise<PaidSession | null> {
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return null;
  try {
    return paidFromSession(await stripe().checkout.sessions.retrieve(sessionId));
  } catch {
    return null;
  }
}

/** Kept for callers that only need the inputs. */
export async function paidInputs(sessionId: string): Promise<ProInputs | null> {
  return (await paidSession(sessionId))?.inputs ?? null;
}

// The "report emailed" flag lives on the PaymentIntent's metadata so a rebuild or a
// webhook retry never sends the same paid report twice. No database needed.
export async function alreadyEmailed(paymentIntentId: string | null): Promise<boolean> {
  if (!paymentIntentId) return false;
  try {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId);
    return !!pi.metadata?.report_emailed_at;
  } catch {
    return false;
  }
}

export async function markEmailed(paymentIntentId: string | null, value = new Date().toISOString()): Promise<void> {
  if (!paymentIntentId) return;
  // An empty string removes the key, which releases a claim after a failed send.
  await stripe().paymentIntents.update(paymentIntentId, { metadata: { report_emailed_at: value } }).catch((e) => {
    console.warn("[billing] could not flag emailed:", (e as Error).message);
  });
}
