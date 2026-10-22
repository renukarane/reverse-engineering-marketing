import { createHmac, timingSafeEqual } from "node:crypto";

// One admin, one password (ADMIN_PASSWORD). Logging in sets a signed, httpOnly
// cookie that expires after 7 days; changing the password logs everyone out.

export const ADMIN_COOKIE = "ms_admin";
const TTL_SEC = 7 * 24 * 3600;

export function adminConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD ?? "").length >= 8;
}

function sign(exp: number): string {
  return createHmac("sha256", `admin:${process.env.ADMIN_PASSWORD}`).update(String(exp)).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(pw: string): boolean {
  return adminConfigured() && safeEqual(pw, process.env.ADMIN_PASSWORD!);
}

export function adminCookie(now = Date.now()): { name: string; value: string; maxAge: number } {
  const exp = Math.floor(now / 1000) + TTL_SEC;
  return { name: ADMIN_COOKIE, value: `${exp}.${sign(exp)}`, maxAge: TTL_SEC };
}

export function validAdminCookie(value: string | undefined, now = Date.now()): boolean {
  if (!adminConfigured() || !value) return false;
  const [expStr, mac] = value.split(".");
  const exp = Number(expStr);
  if (!exp || !mac || exp < now / 1000) return false;
  return safeEqual(mac, sign(exp));
}

function cookieFrom(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function isAdmin(req: Request): boolean {
  return validAdminCookie(cookieFrom(req, ADMIN_COOKIE));
}
