// Mock of the Razorpay Orders and Payments API for local tests.
// GET /__pay/:orderId[?status=authorized] simulates a UPI payment and returns what
// Checkout hands the browser (ids and signature), signed with MOCK_KEY_SECRET.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
const SECRET = process.env.MOCK_KEY_SECRET || "rzp_secret_test";
const orders = new Map();
const payments = new Map();
const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 12).padEnd(10, "x")}`;
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(obj)); };
    const u = new URL(req.url, "http://x");
    const b = body ? JSON.parse(body) : {};
    let m;
    if (req.method === "POST" && u.pathname === "/v1/orders") {
      const o = { id: rid("order"), entity: "order", amount: b.amount, currency: b.currency, receipt: b.receipt, status: "created", notes: b.notes || [], created_at: Math.floor(Date.now() / 1000) };
      orders.set(o.id, o);
      return send(200, o);
    }
    if ((m = u.pathname.match(/^\/v1\/orders\/(order_\w+)$/))) return orders.has(m[1]) ? send(200, orders.get(m[1])) : send(400, { error: { description: "not found" } });
    if ((m = u.pathname.match(/^\/v1\/payments\/(pay_\w+)\/capture$/)) && req.method === "POST") {
      const p = payments.get(m[1]);
      p.status = "captured";
      orders.get(p.order_id).status = "paid";
      return send(200, p);
    }
    if ((m = u.pathname.match(/^\/v1\/payments\/(pay_\w+)$/))) {
      const p = payments.get(m[1]);
      if (!p) return send(400, { error: { description: "not found" } });
      if (req.method === "PATCH") p.notes = { ...(Array.isArray(p.notes) ? {} : p.notes), ...b.notes };
      return send(200, p);
    }
    if ((m = u.pathname.match(/^\/__pay\/(order_\w+)$/))) {
      const o = orders.get(m[1]);
      const status = u.searchParams.get("status") || "captured";
      const p = { id: rid("pay"), entity: "payment", order_id: o.id, amount: o.amount, currency: o.currency, status, method: "upi", vpa: "success@razorpay", email: "upi.buyer@example.com", notes: [] };
      payments.set(p.id, p);
      if (status === "captured") o.status = "paid";
      const signature = createHmac("sha256", SECRET).update(`${o.id}|${p.id}`).digest("hex");
      return send(200, { razorpay_order_id: o.id, razorpay_payment_id: p.id, razorpay_signature: signature });
    }
    send(404, { error: { description: "not mocked" } });
  });
}).listen(Number(process.env.PORT) || 4500);
