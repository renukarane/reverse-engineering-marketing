import { lookup as dnsLookup } from "node:dns";
import net from "node:net";
import { Agent, EnvHttpProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

// The server fetches URLs that users type in, so every request goes through this
// module. It blocks private, loopback and link-local targets (SSRF), checks the
// resolved IP at connect time (so DNS rebinding cannot slip past), caps size and
// time, and re-validates every redirect hop.

const MAX_BYTES = 2_500_000;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const USER_AGENT =
  "Mozilla/5.0 (compatible; MarketingScholarsBot/0.1; +https://github.com/renukarane/reverse-engineering-marketing)";

export class FetchBlockedError extends Error {}

// Local fixture testing only. Ignored in production builds.
const allowPrivate = () => process.env.ALLOW_PRIVATE_FETCH === "true" && process.env.NODE_ENV !== "production";

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}

function assertSafeUrl(u: URL) {
  if (allowPrivate()) return;
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new FetchBlockedError(`Only http and https URLs are allowed`);
  }
  if (u.port && u.port !== "80" && u.port !== "443") {
    throw new FetchBlockedError(`Non-standard ports are not allowed`);
  }
  if (u.username || u.password) throw new FetchBlockedError(`Credentials in URLs are not allowed`);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchBlockedError(`Local hostnames are not allowed`);
  }
  if (net.isIP(host) && isPrivateIp(host)) throw new FetchBlockedError(`Private addresses are not allowed`);
}

// Connect-time lookup that refuses private addresses.
function safeLookup(
  hostname: string,
  options: object,
  callback: (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void,
) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as { address: string; family: number }[];
    const bad = list.find((a) => isPrivateIp(a.address));
    if (bad || list.length === 0) {
      return callback(new FetchBlockedError(`Blocked private address for ${hostname}`) as NodeJS.ErrnoException, "");
    }
    if ((options as { all?: boolean }).all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

let dispatcher: Dispatcher | undefined;
function getDispatcher(): Dispatcher {
  if (dispatcher) return dispatcher;
  // In sandboxes that only allow egress through a proxy, the proxy does DNS.
  // Hostname and literal-IP checks above still apply there.
  dispatcher = allowPrivate()
    ? new Agent()
    : process.env.HTTPS_PROXY || process.env.https_proxy
      ? new EnvHttpProxyAgent()
      : new Agent({ connect: { lookup: safeLookup as never } });
  return dispatcher;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  contentType: string;
  text: string;
}

export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) {
    throw new FetchBlockedError("Only http and https URLs are allowed");
  }
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = new URL(s);
  assertSafeUrl(u);
  return u;
}

export async function safeFetch(input: string | URL, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<FetchResult> {
  let current = typeof input === "string" ? normalizeUrl(input) : input;
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS);
  const maxBytes = opts.maxBytes ?? MAX_BYTES;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeUrl(current);
    const res = await undiciFetch(current, {
      redirect: "manual",
      signal: deadline,
      dispatcher: getDispatcher(),
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      await res.body?.cancel();
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    let text = "";
    if (res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      text = Buffer.concat(chunks).toString("utf8");
    }
    return { ok: res.ok, status: res.status, url: current.toString(), contentType, text };
  }
  throw new FetchBlockedError("Too many redirects");
}

/** Like safeFetch but never throws: returns null on any failure. */
export async function tryFetch(input: string | URL, opts?: { timeoutMs?: number; maxBytes?: number }): Promise<FetchResult | null> {
  try {
    const r = await safeFetch(input, opts);
    return r.ok ? r : null;
  } catch {
    return null;
  }
}
