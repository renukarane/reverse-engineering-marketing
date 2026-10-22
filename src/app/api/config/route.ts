import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { priceLabel, proGate } from "@/lib/billing";
import { emailConfigured } from "@/lib/email";
import { confirmFlowOn } from "@/lib/requests";

export const dynamic = "force-dynamic";

export function GET() {
  const gate = proGate();
  return NextResponse.json({ proFreeBeta: gate === "free", proGate: gate, price: priceLabel(), aiEnabled: aiConfigured(), emailEnabled: emailConfigured(), emailOnly: confirmFlowOn() });
}
