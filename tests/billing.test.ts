import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { validAccessCode } from "../src/lib/access";
import { paidFromProof, priceLabel, proGate, verifyCheckoutSignature, verifyWebhookSignature } from "../src/lib/billing";

function withEnv(env: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  };
  const r = fn();
  return r instanceof Promise ? r.finally(restore) : restore();
}

const RZP = { RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "secret123" };

test("proGate: free until Razorpay is configured, explicit flag wins", () => {
  withEnv({ PRO_FREE_BETA: undefined, RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }, () => assert.equal(proGate(), "free"));
  withEnv({ PRO_FREE_BETA: undefined, ...RZP }, () => assert.equal(proGate(), "razorpay"));
  withEnv({ PRO_FREE_BETA: "true", ...RZP }, () => assert.equal(proGate(), "free"));
  withEnv({ PRO_FREE_BETA: "false", RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined }, () => assert.equal(proGate(), "code"));
});

test("priceLabel formats paise as rupees", () => {
  withEnv({ PRO_PRICE_PAISE: undefined }, () => assert.equal(priceLabel(), "₹499"));
  withEnv({ PRO_PRICE_PAISE: "149900" }, () => assert.equal(priceLabel(), "₹1,499"));
  withEnv({ PRO_PRICE_PAISE: "9950" }, () => assert.equal(priceLabel(), "₹99.50"));
});

test("checkout signature is HMAC(order|payment) with the key secret", () => {
  withEnv(RZP, () => {
    const sig = createHmac("sha256", "secret123").update("order_ABC123|pay_XYZ789").digest("hex");
    assert.equal(verifyCheckoutSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: sig }), true);
    assert.equal(verifyCheckoutSignature({ orderId: "order_OTHER1", paymentId: "pay_XYZ789", signature: sig }), false);
    assert.equal(verifyCheckoutSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: "00" }), false);
  });
});

test("webhook signature is HMAC(raw body) with the webhook secret", () => {
  withEnv({ RAZORPAY_WEBHOOK_SECRET: "whsec" }, () => {
    const body = '{"event":"order.paid"}';
    const sig = createHmac("sha256", "whsec").update(body).digest("hex");
    assert.equal(verifyWebhookSignature(body, sig), true);
    assert.equal(verifyWebhookSignature(body + " ", sig), false);
    assert.equal(verifyWebhookSignature(body, null), false);
  });
});

test("a forged payment proof is rejected without calling Razorpay", async () => {
  await withEnv(RZP, async () => {
    assert.equal(await paidFromProof({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: "forged" }), null);
  });
});

test("access codes match exactly", () => {
  withEnv({ PRO_ACCESS_CODES: "alpha, beta2" }, () => {
    assert.equal(validAccessCode("beta2"), true);
    assert.equal(validAccessCode("beta"), false);
    assert.equal(validAccessCode(undefined), false);
  });
});
