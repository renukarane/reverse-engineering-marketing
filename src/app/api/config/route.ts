import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { priceLabel, proGate } from "@/lib/billing";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export function GET() {
  const gate = proGate();
  return NextResponse.json({ proFreeBeta: gate === "free", proGate: gate, price: priceLabel(), aiEnabled: aiConfigured(), emailEnabled: emailConfigured() });
}
