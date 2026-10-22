import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { dbConfigured, listRequests } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ db: false, rows: [] });
  const page = Math.max(0, Number(new URL(req.url).searchParams.get("page")) || 0);
  try {
    return NextResponse.json({ db: true, rows: await listRequests(50, page * 50) });
  } catch (e) {
    console.error("[admin/requests]", e);
    return NextResponse.json({ db: true, rows: [], error: (e as Error).message.slice(0, 300) }, { status: 502 });
  }
}
