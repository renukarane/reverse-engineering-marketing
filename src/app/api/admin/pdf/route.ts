import { isAdmin } from "@/lib/admin";
import { getRequest } from "@/lib/db";
import { appUrl } from "@/lib/deliver";
import { renderReportPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

// Admin: open the PDF that was emailed for a request.
export async function GET(req: Request) {
  if (!isAdmin(req)) return new Response("Not signed in.", { status: 401 });
  const row = await getRequest(new URL(req.url).searchParams.get("id") ?? "");
  if (!row?.report) return new Response("No report stored for this request yet.", { status: 404 });
  const pdf = await renderReportPdf(row.report, appUrl(new URL(req.url).origin));
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="report-${row.id.slice(0, 8)}.pdf"` } });
}
