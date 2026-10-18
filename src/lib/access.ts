import { timingSafeEqual } from "node:crypto";
import { proGate } from "./billing";

/** Access codes (comps, testers) unlock Pro in any mode. */
export function validAccessCode(code: string | undefined): boolean {
  if (!code) return false;
  const codes = (process.env.PRO_ACCESS_CODES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const a = Buffer.from(code.trim());
  return codes.some((c) => {
    const b = Buffer.from(c);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function proIsFreeBeta(): boolean {
  return proGate() === "free";
}
