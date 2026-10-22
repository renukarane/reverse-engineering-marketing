import type { BrandInput } from "./prompts";
import { FetchBlockedError, normalizeUrl } from "./safeFetch";

// One place that turns form or order-note fields into a BrandInput, for both
// scenarios: an existing brand (name + website required) or a fresh start
// (what you sell + who for required; no website, name optional).

export interface RawBrand {
  stage?: string;
  brandName?: string;
  domain?: string;
  niche?: string;
  audience?: string;
  location?: string;
  goal?: string;
  budget?: string;
}

export function validateBrand(raw: RawBrand): { brand: BrandInput } | { error: string } {
  const v = (x?: string, n = 200) => (x ?? "").trim().slice(0, n);
  const stage = raw.stage === "new" ? "new" : "existing";
  const brand: BrandInput = {
    stage,
    brandName: v(raw.brandName, 80),
    domain: stage === "new" ? "" : v(raw.domain),
    niche: v(raw.niche, 160) || undefined,
    audience: v(raw.audience) || undefined,
    location: v(raw.location, 80) || undefined,
    goal: v(raw.goal) || undefined,
    budget: v(raw.budget, 40) || undefined,
  };
  if (stage === "existing") {
    if (!brand.brandName || !brand.domain) return { error: "Brand name and your website are required for an existing brand." };
    try {
      normalizeUrl(brand.domain);
    } catch (e) {
      return { error: e instanceof FetchBlockedError ? e.message : "Your website does not look like a valid public URL." };
    }
  } else if (!brand.niche || !brand.audience) {
    return { error: "Tell us what you will sell and who you will sell to, so we can build your launch plan." };
  }
  return { brand };
}

/** Flattened fields for Razorpay order notes (max 15 notes of 256 chars). */
export function brandNotes(b: BrandInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(b)) if (val) out[k] = String(val).slice(0, 250);
  return out;
}
