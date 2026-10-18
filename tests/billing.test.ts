import assert from "node:assert/strict";
import { test } from "node:test";
import { validAccessCode } from "../src/lib/access";
import { paidInputs, priceLabel, proGate } from "../src/lib/billing";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  try { fn(); } finally {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
}

test("proGate: free until Stripe is configured, explicit flag wins", () => {
  withEnv({ PRO_FREE_BETA: undefined, STRIPE_SECRET_KEY: undefined }, () => assert.equal(proGate(), "free"));
  withEnv({ PRO_FREE_BETA: undefined, STRIPE_SECRET_KEY: "sk_test_x" }, () => assert.equal(proGate(), "stripe"));
  withEnv({ PRO_FREE_BETA: "true", STRIPE_SECRET_KEY: "sk_test_x" }, () => assert.equal(proGate(), "free"));
  withEnv({ PRO_FREE_BETA: "false", STRIPE_SECRET_KEY: undefined }, () => assert.equal(proGate(), "code"));
});

test("priceLabel formats cents", () => {
  withEnv({ PRO_PRICE_CENTS: undefined }, () => assert.equal(priceLabel(), "$19"));
  withEnv({ PRO_PRICE_CENTS: "2950" }, () => assert.equal(priceLabel(), "$29.50"));
});

test("access codes match exactly", () => {
  withEnv({ PRO_ACCESS_CODES: "alpha, beta2" }, () => {
    assert.equal(validAccessCode("beta2"), true);
    assert.equal(validAccessCode("beta"), false);
    assert.equal(validAccessCode(undefined), false);
  });
});

test("paidInputs rejects malformed session ids without calling Stripe", async () => {
  assert.equal(await paidInputs("not-a-session"), null);
  assert.equal(await paidInputs("cs_test_"), null);
});
