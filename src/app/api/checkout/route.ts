import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, priceLabel, proGate } from "@/lib/billing";
import { validateBrand } from "@/lib/brandInput";
import { insertRequest } from "@/lib/db";
import { confirmFlowOn } from "@/lib/requests";
import { FetchBlockedError, normalizeUrl } from "@/lib/safeFetch";

export const runtime = "nodejs";

const field = (max: number) => z.string().trim().max(max).optional();
const Body = z.object({
  competitorUrl: z.string().trim().min(3).max(240),
  stage: z.enum(["existing", "new"]).optional(),
  brandName: field(80),
  domain: field(200),
  niche: field(160),
  audience: field(200),
  location: field(80),
  goal: field(200),
  budget: field(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

// Creates a Razorpay order for one full report. Inputs are validated now so a
// customer never pays for a URL we would refuse to analyse.
export async function POST(req: Request) {
  if (proGate() !== "razorpay") return NextResponse.json({ error: "Payments are not enabled." }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please fill in the competitor URL and your details." }, { status: 400 });
  const { email, competitorUrl, ...raw } = parsed.data;
  if (confirmFlowOn() && !email) return NextResponse.json({ error: "Enter your email. We send your full plan there." }, { status: 400 });
  try {
    normalizeUrl(competitorUrl);
  } catch (e) {
    return NextResponse.json({ error: e instanceof FetchBlockedError ? e.message : "That does not look like a valid public URL." }, { status: 400 });
  }
  const checked = validateBrand(raw);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const inputs = { competitorUrl, ...checked.brand };
  try {
    const order = await createOrder(inputs, email || undefined);
    // Log the order so the admin sees unpaid attempts too. Fulfilment creates the
    // row itself if this fails, so a database hiccup never blocks a payment.
    if (confirmFlowOn() && email) {
      await insertRequest({ email: email.toLowerCase(), tier: "pro", inputs, status: "awaiting_payment", order_id: order.orderId }).catch((e) => console.error("[checkout] could not log order:", (e as Error).message));
    }
    return NextResponse.json({ ...order, name: "Marketing Scholars", description: `Full marketing plan (${priceLabel()})`, email: email || "" });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Could not start payment. Please try again." }, { status: 502 });
  }
}
