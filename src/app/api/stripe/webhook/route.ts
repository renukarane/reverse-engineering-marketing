import { after } from "next/server";
import type Stripe from "stripe";
import { paidFromSession, stripe } from "@/lib/billing";
import { fulfilPaidSession } from "@/lib/deliver";

export const runtime = "nodejs";
export const maxDuration = 60;

// Stripe calls this the moment Checkout completes. We acknowledge at once, then
// build and email the paid report in the background so the customer gets it even
// if they never return to the site. Duplicate deliveries are skipped via the
// PaymentIntent "report_emailed_at" flag.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 400 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig ?? "", secret);
  } catch (e) {
    console.warn("[webhook] bad signature:", (e as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const paid = paidFromSession(event.data.object as Stripe.Checkout.Session);
    if (paid) {
      after(async () => {
        try {
          await fulfilPaidSession(paid);
        } catch (e) {
          console.error("[webhook] fulfilment failed:", (e as Error).message);
        }
      });
    }
  }
  return Response.json({ received: true });
}
