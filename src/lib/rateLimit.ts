// Per-instance, in-memory limiter. Good enough for an MVP on one server; swap for
// Upstash/Redis when running several instances.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, perHour = Number(process.env.RATE_LIMIT_PER_HOUR) || 10): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowStart = now - 3600_000;
  const list = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (list.length >= perHour) {
    hits.set(key, list);
    return { ok: false, retryAfterSec: Math.ceil((list[0] + 3600_000 - now) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) hits.clear();
  return { ok: true, retryAfterSec: 0 };
}
