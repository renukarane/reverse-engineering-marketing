import { timingSafeEqual } from "node:crypto";

/** Pro is free during beta; otherwise it needs an access code (stand-in for payments). */
export function proAllowed(code: string | undefined): boolean {
  if ((process.env.PRO_FREE_BETA ?? "true") === "true") return true;
  if (!code) return false;
  const codes = (process.env.PRO_ACCESS_CODES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const a = Buffer.from(code.trim());
  return codes.some((c) => {
    const b = Buffer.from(c);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function proIsFreeBeta(): boolean {
  return (process.env.PRO_FREE_BETA ?? "true") === "true";
}
