// Minimal mock of the two Stripe Checkout endpoints the app uses, for local tests.
// Sessions whose brandName is "Unpaid" stay unpaid.
import { createServer } from "node:http";
const sessions = new Map();
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    const u = new URL(req.url, "http://x");
    if (req.method === "POST" && u.pathname === "/v1/checkout/sessions") {
      const f = new URLSearchParams(body);
      const metadata = {};
      for (const [k, v] of f) { const m = k.match(/^metadata\[(.+)\]$/); if (m) metadata[m[1]] = v; }
      const id = "cs_test_" + Math.random().toString(36).slice(2).padEnd(16, "x");
      const s = { id, object: "checkout.session", created: Math.floor(Date.now() / 1000), metadata,
        payment_status: metadata.brandName === "Unpaid" ? "unpaid" : "paid",
        amount_total: Number(f.get("line_items[0][price_data][unit_amount]")), success_url: f.get("success_url") };
      s.url = s.success_url.replace("{CHECKOUT_SESSION_ID}", id);
      sessions.set(id, s);
      return send(200, s);
    }
    const m = u.pathname.match(/^\/v1\/checkout\/sessions\/(cs_[\w]+)$/);
    if (req.method === "GET" && m) return sessions.has(m[1]) ? send(200, sessions.get(m[1])) : send(404, { error: { type: "invalid_request_error", message: "No such session" } });
    send(404, { error: { message: "not mocked" } });
  });
}).listen(Number(process.env.PORT) || 4500);
