import { NextResponse } from "next/server";
import { proIsFreeBeta } from "@/lib/access";
import { aiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ proFreeBeta: proIsFreeBeta(), aiEnabled: aiConfigured() });
}
