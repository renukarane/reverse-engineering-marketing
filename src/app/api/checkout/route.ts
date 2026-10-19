import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, priceLabel, proGate } from "@/lib/billing";
import { FetchBlockedError, normalizeUrl } from "@/lib/safeFetch";

export const runtime = "nodejs";

const field = (max: number) => z.string().trim().max(max).optional();
const Body = z.object({
  competitorUrl: z.string().trim().min(3).max(240),
  brandName: z.string().trim().min(1).max(80),
  domain: z.string().trim().min(3).max(200),
  niche: field(160),
  audience: field(200),
  goal: field(200),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

// Creates a Razorpay order for one full report. Inputs are validated now so a
// customer never pays for a URL we would refuse to analyse.
export async function POST(req: Request) {
  if (proGate() !== "razorpay") return NextResponse.json({ error: "Payments are not enabled." }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please fill in the competitor URL, your brand name and your domain." }, { status: 400 });
  const { email, ...inputs } = parsed.data;
  try {
    normalizeUrl(inputs.competitorUrl);
    normalizeUrl(inputs.domain);
  } catch (e) {
    return NextResponse.json({ error: e instanceof FetchBlockedError ? e.message : "That does not look like a valid public URL." }, { status: 400 });
  }
  try {
    const order = await createOrder(inputs, email || undefined);
    return NextResponse.json({ ...order, name: "MarketMirror", description: `Full marketing plan (${priceLabel()})`, email: email || "" });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Could not start payment. Please try again." }, { status: 502 });
  }
}
