import { z } from "zod";
import { validateBrand } from "./brandInput";
import type { ReportInputs } from "./db";
import type { BrandInput } from "./prompts";
import { FetchBlockedError, normalizeUrl } from "./safeFetch";
import type { Tier } from "./types";

// The report form's fields, shared by /api/request (email-confirmed reports)
// and /api/analyze (admin, legacy and paid).

const field = (max: number) => z.string().trim().max(max).optional();
export const ReportFields = z.object({
  competitorUrl: z.string().trim().max(300).default(""),
  tier: z.enum(["free", "pro"]).default("free"),
  stage: z.enum(["existing", "new"]).optional(),
  brandName: field(80),
  domain: field(200),
  niche: field(160),
  audience: field(200),
  goal: field(200),
  location: field(80),
  budget: field(80),
  accessCode: field(100),
  email: z.string().trim().max(200).optional(),
});
export type ReportFields = z.infer<typeof ReportFields>;

export const EmailSchema = z.string().email();

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** Checks the competitor URL and, for Pro, the brand fields. */
export function checkReportInput(b: Pick<ReportFields, "competitorUrl" | "tier"> & Partial<ReportFields>):
  | { error: string }
  | { tier: Tier; inputs: ReportInputs; brand?: BrandInput } {
  if (b.competitorUrl.length < 3) return { error: "Please enter a valid competitor URL." };
  try {
    normalizeUrl(b.competitorUrl);
  } catch (e) {
    return { error: e instanceof FetchBlockedError ? e.message : "That does not look like a valid public URL." };
  }
  if (b.tier !== "pro") return { tier: "free", inputs: { competitorUrl: b.competitorUrl } };
  const checked = validateBrand(b);
  if ("error" in checked) return checked;
  return { tier: "pro", inputs: { competitorUrl: b.competitorUrl, ...checked.brand }, brand: checked.brand };
}
