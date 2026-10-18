import { NextResponse } from "next/server";
import { z } from "zod";
import { proAllowed } from "@/lib/access";
import { analyze } from "@/lib/analyze";
import { rateLimit } from "@/lib/rateLimit";
import { FetchBlockedError, normalizeUrl } from "@/lib/safeFetch";

export const runtime = "nodejs";
export const maxDuration = 60;

const field = (max: number) => z.string().trim().max(max).optional();
const Body = z.object({
  competitorUrl: z.string().trim().min(3).max(300),
  tier: z.enum(["free", "pro"]).default("free"),
  brandName: field(80),
  domain: field(200),
  niche: field(160),
  audience: field(200),
  goal: field(200),
  budget: field(80),
  accessCode: field(100),
});

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid competitor URL." }, { status: 400 });
  const b = parsed.data;

  try {
    normalizeUrl(b.competitorUrl);
    if (b.tier === "pro") {
      if (!b.brandName || !b.domain) return NextResponse.json({ error: "Brand name and your domain are required for the full report." }, { status: 400 });
      normalizeUrl(b.domain);
    }
  } catch (e) {
    const msg = e instanceof FetchBlockedError ? e.message : "That does not look like a valid public URL.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (b.tier === "pro" && !proAllowed(b.accessCode)) {
    return NextResponse.json({ error: "The full report needs a valid access code.", code: "PAYWALL" }, { status: 402 });
  }

  const rl = rateLimit(clientIp(req));
  if (!rl.ok) {
    return NextResponse.json({ error: `Too many reports from your network. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  }

  try {
    const report = await analyze({
      competitorUrl: b.competitorUrl,
      tier: b.tier,
      brand: b.tier === "pro" ? { brandName: b.brandName!, domain: b.domain!, niche: b.niche, audience: b.audience, goal: b.goal, budget: b.budget } : undefined,
    });
    return NextResponse.json(report);
  } catch (e) {
    console.error("[analyze]", e);
    const msg = e instanceof FetchBlockedError ? e.message : "We could not read that website. Check the URL, or the site may block automated visitors.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
