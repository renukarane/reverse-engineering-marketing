import { cookies } from "next/headers";
import { z } from "zod";
import { AB_COOKIE, UID_COOKIE, parseVariant, variantProps } from "@/lib/experiments";

export const runtime = "nodejs";

const Body = z.object({
  event: z.enum([
    "lp_view",
    "cta_click",
    "scroll_50",
    "faq_open",
    "report_started",
    "report_completed",
    "report_failed",
    "pdf_download",
    "html_view",
    "upgrade_click",
    "checkout_started",
    "payment_success",
  ]),
  props: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

// First-party event endpoint. Forwards to PostHog when POSTHOG_KEY is set (ad
// blockers cannot drop it because it is our own domain) and always writes one
// JSON log line, so results are visible in Vercel logs even without PostHog.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });
  const jar = await cookies();
  const variant = parseVariant(jar.get(AB_COOKIE)?.value);
  const distinctId = jar.get(UID_COOKIE)?.value || "anonymous";
  const properties = {
    ...(variant ? variantProps(variant) : {}),
    ...parsed.data.props,
    $current_url: req.headers.get("referer") ?? undefined,
  };
  console.log(JSON.stringify({ t: "ab_event", event: parsed.data.event, uid: distinctId.slice(0, 8), ...properties }));

  const key = process.env.POSTHOG_KEY;
  if (key) {
    const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, event: parsed.data.event, distinct_id: distinctId, properties, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  }
  return new Response(null, { status: 204 });
}
