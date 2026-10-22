// Mock of the Supabase REST API (PostgREST) for the report_requests table.
// Supports the filters the app uses: eq, in, lt and is, plus select, order,
// limit, offset, on_conflict with ignore-duplicates, and return=representation.
// GET /__rows lists every row.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const rows = [];
const KEY = process.env.MOCK_SUPABASE_KEY || "sb_secret_test";
const UNIQUE = ["token_hash", "order_id"];

function matches(row, key, expr) {
  const v = row[key];
  if (expr.startsWith("eq.")) return String(v) === expr.slice(3);
  if (expr.startsWith("in.(")) return expr.slice(4, -1).split(",").includes(String(v));
  if (expr.startsWith("lt.")) return v != null && String(v) < expr.slice(3);
  if (expr === "is.null") return v == null;
  if (expr === "not.is.null") return v != null;
  throw new Error(`filter not mocked: ${key}=${expr}`);
}

function project(row, select) {
  if (!select || select === "*") return row;
  return Object.fromEntries(select.split(",").map((k) => [k, row[k] ?? null]));
}

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, obj) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(obj === undefined ? "" : JSON.stringify(obj));
    };
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/__rows") return send(200, rows);
    if (req.headers.apikey !== KEY) return send(401, { message: "Invalid API key" });
    if (req.headers.authorization && !KEY.startsWith("eyJ")) return send(401, { message: "Bearer must be a JWT" });
    if (u.pathname !== "/rest/v1/report_requests") return send(404, { message: "not mocked" });

    const prefer = req.headers.prefer || "";
    const filters = [];
    let select, order, limit, offset, onConflict;
    for (const [k, v] of u.searchParams) {
      if (k === "select") select = v;
      else if (k === "order") order = v;
      else if (k === "limit") limit = Number(v);
      else if (k === "offset") offset = Number(v);
      else if (k === "on_conflict") onConflict = v;
      else filters.push([k, v]);
    }
    const hit = (r) => filters.every(([k, v]) => matches(r, k, v));
    const out = (list) => (prefer.includes("return=minimal") ? send(204) : send(req.method === "POST" ? 201 : 200, list.map((r) => project(r, select))));

    try {
      if (req.method === "GET") {
        let list = rows.filter(hit);
        if (order) {
          const [col, dir] = order.split(".");
          list = [...list].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1));
        }
        list = list.slice(offset || 0, limit ? (offset || 0) + limit : undefined);
        return send(200, list.map((r) => project(r, select)));
      }
      if (req.method === "POST") {
        const input = JSON.parse(body);
        const created = [];
        for (const b of Array.isArray(input) ? input : [input]) {
          const clash = UNIQUE.find((k) => b[k] != null && rows.some((r) => r[k] === b[k]));
          if (clash) {
            if (onConflict === clash && prefer.includes("ignore-duplicates")) continue;
            return send(409, { code: "23505", message: `duplicate key value violates unique constraint on ${clash}` });
          }
          const row = { id: randomUUID(), created_at: new Date().toISOString(), token_hash: null, confirmed_at: null, claimed_at: null, sent_at: null, order_id: null, payment_id: null, engine: null, error: null, ip: null, report: null, ...b };
          rows.push(row);
          created.push(row);
        }
        return out(created);
      }
      if (req.method === "PATCH") {
        const patch = JSON.parse(body);
        const list = rows.filter(hit);
        for (const r of list) Object.assign(r, patch);
        return out(list);
      }
    } catch (e) {
      return send(400, { message: e.message });
    }
    send(405, { message: "method not mocked" });
  });
}).listen(Number(process.env.PORT) || 4700);
