import type { Report, Tier } from "./types";

// Supabase, used only from the server through its REST API (PostgREST) with the
// secret / service-role key. One table, report_requests: every report anyone asks
// for, its confirmation token, and the report once built. The schema lives in
// supabase/schema.sql. Row Level Security is on with no policies, so the public
// anon key can read nothing.

export type RequestStatus = "awaiting_payment" | "awaiting_confirmation" | "building" | "sent" | "failed";

export interface ReportInputs {
  competitorUrl: string;
  stage?: "existing" | "new";
  brandName?: string;
  domain?: string;
  niche?: string;
  audience?: string;
  location?: string;
  budget?: string;
  goal?: string;
}

export interface ReportRequest {
  id: string;
  created_at: string;
  email: string;
  tier: Tier;
  inputs: ReportInputs;
  status: RequestStatus;
  token_hash: string | null;
  confirmed_at: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  order_id: string | null;
  payment_id: string | null;
  engine: string | null;
  error: string | null;
  ip: string | null;
  report: Report | null;
}

const TABLE = "report_requests";

export function dbConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // Legacy service_role keys are JWTs and go in Authorization too. The newer
  // sb_secret_ keys are not JWTs and must only be sent as apikey.
  return {
    apikey: key,
    ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}),
    "content-type": "application/json",
    ...extra,
  };
}

async function rest<T>(method: "GET" | "POST" | "PATCH", query: string, body?: unknown, prefer = "return=representation"): Promise<T> {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/rest/v1/${TABLE}${query}`, {
    method,
    headers: headers({ prefer }),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${TABLE}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : []) as T;
}

const enc = encodeURIComponent;
// Everything but the stored report, for lists.
const LIST_COLUMNS = "id,created_at,email,tier,inputs,status,confirmed_at,sent_at,order_id,payment_id,engine,error";

export async function insertRequest(row: Partial<ReportRequest> & Pick<ReportRequest, "email" | "tier" | "inputs" | "status">): Promise<ReportRequest> {
  const [r] = await rest<ReportRequest[]>("POST", "", row);
  return r;
}

/** Inserts the row for a paid order unless one already exists. */
export async function ensureOrderRow(row: Pick<ReportRequest, "email" | "tier" | "inputs" | "status" | "order_id" | "payment_id">): Promise<void> {
  await rest("POST", "?on_conflict=order_id", row, "resolution=ignore-duplicates,return=minimal");
}

export async function getRequest(id: string): Promise<ReportRequest | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await rest<ReportRequest[]>("GET", `?id=eq.${enc(id)}&limit=1`);
  return r ?? null;
}

export async function getByTokenHash(hash: string): Promise<ReportRequest | null> {
  const [r] = await rest<ReportRequest[]>("GET", `?token_hash=eq.${enc(hash)}&select=${LIST_COLUMNS}&limit=1`);
  return r ?? null;
}

export async function getByOrderId(orderId: string): Promise<ReportRequest | null> {
  const [r] = await rest<ReportRequest[]>("GET", `?order_id=eq.${enc(orderId)}&select=${LIST_COLUMNS}&limit=1`);
  return r ?? null;
}

/**
 * Moves a row to "building" only if it is still in one of the given states, so two
 * requests racing for the same report never both build it. A "building" row left
 * behind by a crashed run can be reclaimed after `staleMs`.
 */
export async function claim(filter: string, from: RequestStatus[], fields: Partial<ReportRequest> = {}, staleMs = 5 * 60_000): Promise<ReportRequest | null> {
  const now = new Date().toISOString();
  const set = { ...fields, status: "building", claimed_at: now, error: null };
  const [r] = await rest<ReportRequest[]>("PATCH", `?${filter}&status=in.(${from.join(",")})&select=${LIST_COLUMNS}`, set);
  if (r) return r;
  const staleBefore = new Date(Date.now() - staleMs).toISOString();
  const [s] = await rest<ReportRequest[]>("PATCH", `?${filter}&status=eq.building&claimed_at=lt.${enc(staleBefore)}&select=${LIST_COLUMNS}`, set);
  return s ?? null;
}

export async function updateRequest(id: string, fields: Partial<ReportRequest>): Promise<void> {
  await rest("PATCH", `?id=eq.${enc(id)}`, fields, "return=minimal");
}

export async function listRequests(limit = 50, offset = 0): Promise<ReportRequest[]> {
  return rest<ReportRequest[]>("GET", `?select=${LIST_COLUMNS}&order=created_at.desc&limit=${limit}&offset=${offset}`);
}
