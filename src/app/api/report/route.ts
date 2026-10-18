import { normalizePlan, normalizeTeardown } from "@/lib/normalize";
import { renderReportPdf } from "@/lib/pdf";
import type { Report } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Renders a report the client already holds into a PDF. Input is re-normalized so
// the renderer only ever sees well-formed, length-capped strings.
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 400_000) return new Response("Report too large", { status: 413 });
  let body: Partial<Report>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const td = body.teardown;
  if (!td) return new Response("Missing teardown", { status: 400 });
  const teardown = normalizeTeardown(td, {
    competitor: String(td.competitor ?? "Competitor").slice(0, 80),
    url: String(td.url ?? "").slice(0, 300),
    generatedAt: String(td.generatedAt ?? new Date().toISOString()).slice(0, 30),
    engine: String(td.engine ?? "").slice(0, 80),
  });
  const plan = body.tier === "pro" && body.plan
    ? normalizePlan(body.plan, { brandName: String(body.plan.brandName ?? "").slice(0, 80), domain: String(body.plan.domain ?? "").slice(0, 200) })
    : undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const pdf = await renderReportPdf({ tier: plan ? "pro" : "free", teardown, plan }, appUrl);
  const slug = teardown.competitor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "competitor";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${slug}-${plan ? "full-plan" : "teardown"}.pdf"`,
    },
  });
}
