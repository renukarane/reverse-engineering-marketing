import { after } from "next/server";
import { paidOrder, verifyWebhookSignature } from "@/lib/billing";
import { fulfilPaidOrder } from "@/lib/deliver";

export const runtime = "nodejs";
export const maxDuration = 60;

// Razorpay calls this the moment a payment is captured. We acknowledge at once
// (Razorpay expects a reply within 5 seconds), then build and email the paid
// report in the background, so the customer gets it even if they closed the tab.
// Duplicate deliveries are skipped via the "report_emailed_at" payment note.
export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyWebhookSignature(body, req.headers.get("x-razorpay-signature"))) {
    return new Response("Invalid signature", { status: 400 });
  }
  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  if ((event.event === "order.paid" || event.event === "payment.captured") && payment?.id && payment.order_id) {
    const { id, order_id } = payment;
    after(async () => {
      try {
        // Re-read from Razorpay rather than trusting the payload's fields.
        const paid = await paidOrder(order_id, id);
        if (paid) await fulfilPaidOrder(paid);
      } catch (e) {
        console.error("[webhook] fulfilment failed:", (e as Error).message);
      }
    });
  }
  return Response.json({ received: true });
}
