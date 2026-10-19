import { NextResponse, type NextRequest } from "next/server";
import { AB_COOKIE, UID_COOKIE, parseVariant, randomVariant, serializeVariant, type Arm } from "@/lib/experiments";

// Assigns each visitor a sticky A/B variant and an anonymous id before the page
// renders, so the server can render the right version with no flicker.
export function middleware(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  let v = q.get("ab") === "reset" ? null : parseVariant(req.cookies.get(AB_COOKIE)?.value);
  v ??= randomVariant();
  for (const k of ["pos", "hook", "design"] as const) {
    const o = q.get(k);
    if (o === "a" || o === "b") v[k] = o as Arm;
  }
  const value = serializeVariant(v);
  const uid = req.cookies.get(UID_COOKIE)?.value || crypto.randomUUID();

  // Make the cookies visible to this request's server render as well.
  req.cookies.set(AB_COOKIE, value);
  req.cookies.set(UID_COOKIE, uid);
  const res = NextResponse.next({ request: { headers: req.headers } });
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" as const };
  res.cookies.set(AB_COOKIE, value, opts);
  res.cookies.set(UID_COOKIE, uid, opts);
  return res;
}

export const config = { matcher: ["/"] };
