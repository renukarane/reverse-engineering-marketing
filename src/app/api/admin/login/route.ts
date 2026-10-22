import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, adminCookie, checkPassword, isAdmin } from "@/lib/admin";
import { rateLimit } from "@/lib/rateLimit";
import { clientIp } from "@/lib/reportInput";

export const runtime = "nodejs";

export function GET(req: Request) {
  return NextResponse.json({ admin: isAdmin(req), configured: adminConfigured() });
}

export async function POST(req: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: "Set ADMIN_PASSWORD (8+ characters) in Vercel first." }, { status: 400 });
  if (!rateLimit(`admin-login:${clientIp(req)}`, 10).ok) return NextResponse.json({ error: "Too many attempts. Try again in an hour." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof body.password !== "string" || !checkPassword(body.password)) return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  const c = adminCookie();
  const res = NextResponse.json({ admin: true });
  res.cookies.set(c.name, c.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: c.maxAge });
  return res;
}

export function DELETE() {
  const res = NextResponse.json({ admin: false });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
