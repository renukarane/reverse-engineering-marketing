import { after, NextResponse } from "next/server";
import { z } from "zod";
import { appUrl } from "@/lib/deliver";
import { rateLimit } from "@/lib/rateLimit";
import { clientIp } from "@/lib/reportInput";
import { buildAndSend, confirmFlowOn, confirmRequest, maskEmail } from "@/lib/requests";

export const runtime = "nodejs";
export const maxDuration = 60;

// Step 2: the visitor clicked the link in their email. Confirm once, reply at
// once, then build the report and email the PDF in the background.
export async function POST(req: Request) {
  if (!confirmFlowOn()) return NextResponse.json({ error: "Email delivery is not set up." }, { status: 400 });
  const parsed = z.object({ token: z.string().max(100) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: "invalid" }, { status: 400 });
  if (!rateLimit(`confirm:${clientIp(req)}`, 30).ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  try {
    const r = await confirmRequest(parsed.data.token);
    if (r.status === "building") {
      const { row } = r;
      const url = appUrl(new URL(req.url).origin);
      after(() => buildAndSend(row, url));
      return NextResponse.json({ status: "building", to: maskEmail(row.email), tier: row.tier });
    }
    return NextResponse.json(r, { status: r.status === "already" ? 200 : 400 });
  } catch (e) {
    console.error("[confirm]", e);
    return NextResponse.json({ error: "Something went wrong. Please click the link in your email again." }, { status: 502 });
  }
}
