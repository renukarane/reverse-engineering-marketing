import { after, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { claim, getRequest } from "@/lib/db";
import { appUrl } from "@/lib/deliver";
import { buildAndSend } from "@/lib/requests";

export const runtime = "nodejs";
export const maxDuration = 60;

// Admin: email a request's report again. Reuses the stored report unless asked
// to rebuild (or there is none yet, e.g. it failed or was never confirmed).
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid(), rebuild: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const full = await getRequest(parsed.data.id);
  if (!full) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const row = await claim(`id=eq.${full.id}`, ["sent", "failed", "awaiting_confirmation", "awaiting_payment"]);
  if (!row) return NextResponse.json({ error: "It is being built right now. Refresh in a minute." }, { status: 409 });
  const reuse = parsed.data.rebuild ? null : full.report;
  const url = appUrl(new URL(req.url).origin);
  after(() => buildAndSend(row, url, { reuse }));
  return NextResponse.json({ status: "building" });
}
