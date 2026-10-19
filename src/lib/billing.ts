import { createHmac, timingSafeEqual } from "node:crypto";

// One-time Razorpay payment per full report, UPI only, in INR. No database:
// the report inputs ride in the Razorpay Order's notes, and the server re-reads
// the order and payment from Razorpay to confirm it was paid. A paid order can
// only ever regenerate the report it paid for, so reusing its ids gains nothing.

export type ProGate = "free" | "razorpay" | "code";

export interface ProInputs {
  competitorUrl: string;
  brandName: string;
  domain: string;
  niche?: string;
  audience?: string;
  goal?: string;
}

export interface PaidOrder {
  inputs: ProInputs;
  email: string | null;
  orderId: string;
  paymentId: string;
  /** Unix seconds when the order was created. */
  created: number;
}

/** What the browser keeps after paying, to show or rebuild the report. */
export interface PaymentProof {
  orderId: string;
  paymentId: string;
  signature: string;
}

const ORDER_VALID_DAYS = 7;

function keys() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  return { id, secret };
}

function apiBase(): string {
  // RAZORPAY_API_BASE points at a local mock in tests; ignored in production.
  return process.env.NODE_ENV !== "production" && process.env.RAZORPAY_API_BASE
    ? process.env.RAZORPAY_API_BASE.replace(/\/$/, "")
    : "https://api.razorpay.com";
}

async function rzp<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const { id, secret } = keys();
  const res = await fetch(`${apiBase()}/v1${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(`Razorpay ${method} ${path}: HTTP ${res.status} ${data.error?.description ?? ""}`.trim());
  return data;
}

interface RzpOrder {
  id: string;
  status: "created" | "attempted" | "paid";
  amount: number;
  currency: string;
  created_at: number;
  notes: Record<string, string> | [];
}

interface RzpPayment {
  id: string;
  order_id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
  email?: string;
  method?: string;
  notes: Record<string, string> | [];
}

export function proGate(): ProGate {
  const beta = process.env.PRO_FREE_BETA;
  const configured = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
  // Free beta is the default only until Razorpay is configured.
  if (beta === "true" || (beta === undefined && !configured)) return "free";
  return configured ? "razorpay" : "code";
}

export function pricePaise(): number {
  return Number(process.env.PRO_PRICE_PAISE) || 49900;
}

export function priceLabel(): string {
  const p = pricePaise();
  return `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: p % 100 ? 2 : 0, minimumFractionDigits: p % 100 ? 2 : 0 })}`;
}

const notesOf = (n: RzpOrder["notes"]): Record<string, string> => (Array.isArray(n) ? {} : n ?? {});

/** Creates the order the browser's Razorpay Checkout will pay. */
export async function createOrder(inputs: ProInputs, email?: string) {
  // Razorpay allows 15 notes of up to 256 characters each.
  const notes: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...inputs, email })) if (v) notes[k] = String(v).slice(0, 250);
  const order = await rzp<RzpOrder>("POST", "/orders", {
    amount: pricePaise(),
    currency: "INR",
    receipt: `mm_${Date.now().toString(36)}`,
    notes,
  });
  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: keys().id };
}

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success signature: HMAC-SHA256(order_id|payment_id, key secret). */
export function verifyCheckoutSignature(p: PaymentProof): boolean {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  return safeEqualHex(hmac(process.env.RAZORPAY_KEY_SECRET, `${p.orderId}|${p.paymentId}`), p.signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  return safeEqualHex(hmac(secret, rawBody), signature);
}

export function webhookConfigured(): boolean {
  return !!process.env.RAZORPAY_WEBHOOK_SECRET;
}

/**
 * Confirms with Razorpay that the order was paid by this payment and returns
 * the report inputs stored on the order. Captures an authorized payment if the
 * account does not auto-capture. Returns null if unpaid, mismatched or expired.
 */
export async function paidOrder(orderId: string, paymentId: string): Promise<PaidOrder | null> {
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId) || !/^pay_[A-Za-z0-9]{6,40}$/.test(paymentId)) return null;
  try {
    let payment = await rzp<RzpPayment>("GET", `/payments/${paymentId}`);
    if (payment.order_id !== orderId) return null;
    if (payment.status === "authorized") {
      payment = await rzp<RzpPayment>("POST", `/payments/${paymentId}/capture`, { amount: payment.amount, currency: payment.currency });
    }
    if (payment.status !== "captured") return null;
    const order = await rzp<RzpOrder>("GET", `/orders/${orderId}`);
    if (Date.now() / 1000 - order.created_at > ORDER_VALID_DAYS * 86400) return null;
    const n = notesOf(order.notes);
    if (!n.competitorUrl || !n.brandName || !n.domain) return null;
    return {
      inputs: { competitorUrl: n.competitorUrl, brandName: n.brandName, domain: n.domain, niche: n.niche, audience: n.audience, goal: n.goal },
      email: n.email || payment.email || null,
      orderId,
      paymentId,
      created: order.created_at,
    };
  } catch (e) {
    console.warn("[billing] could not confirm payment:", (e as Error).message);
    return null;
  }
}

/** Browser path: checks the checkout signature, then confirms with Razorpay. */
export async function paidFromProof(p: PaymentProof): Promise<PaidOrder | null> {
  if (!verifyCheckoutSignature(p)) return null;
  return paidOrder(p.orderId, p.paymentId);
}

// The "report emailed" flag lives in the payment's notes so a rebuild or a
// webhook retry never sends the same paid report twice. No database needed.
export async function alreadyEmailed(paymentId: string): Promise<boolean> {
  try {
    const p = await rzp<RzpPayment>("GET", `/payments/${paymentId}`);
    return !!notesOf(p.notes).report_emailed_at;
  } catch {
    return false;
  }
}

export async function markEmailed(paymentId: string, value = new Date().toISOString()): Promise<void> {
  // An empty value releases a claim after a failed send.
  await rzp("PATCH", `/payments/${paymentId}`, { notes: { report_emailed_at: value } }).catch((e) => {
    console.warn("[billing] could not flag emailed:", (e as Error).message);
  });
}
