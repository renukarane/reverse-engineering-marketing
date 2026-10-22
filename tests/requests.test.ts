import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { after, before, test } from "node:test";
import { adminCookie, checkPassword, validAdminCookie } from "../src/lib/admin";
import { confirmEmail } from "../src/lib/email";

// Database and email run against the local mocks, started once for this file.
const SB_PORT = 4791;
const RS_PORT = 4792;
const procs: ChildProcess[] = [];

async function waitFor(url: string) {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`mock did not start: ${url}`);
}

before(async () => {
  procs.push(spawn(process.execPath, ["tests/fixtures/mock-supabase.mjs"], { env: { ...process.env, PORT: String(SB_PORT) }, stdio: "ignore" }));
  procs.push(spawn(process.execPath, ["tests/fixtures/mock-resend.mjs"], { env: { ...process.env, PORT: String(RS_PORT) }, stdio: "ignore" }));
  Object.assign(process.env, {
    SUPABASE_URL: `http://127.0.0.1:${SB_PORT}`,
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
    RESEND_API_KEY: "re_test",
    RESEND_API_BASE: `http://127.0.0.1:${RS_PORT}`,
    EMAIL_FROM: "Test <t@example.com>",
    ADMIN_PASSWORD: "correct horse battery",
  });
  await waitFor(`http://127.0.0.1:${SB_PORT}/__rows`);
  await waitFor(`http://127.0.0.1:${RS_PORT}/__sent`);
});

after(() => procs.forEach((p) => p.kill()));

test("admin cookie: valid, tampered, expired, and wrong password", () => {
  const c = adminCookie();
  assert.ok(validAdminCookie(c.value));
  assert.ok(!validAdminCookie(c.value.replace(/.$/, (ch) => (ch === "a" ? "b" : "a"))));
  assert.ok(!validAdminCookie(adminCookie(Date.now() - 8 * 24 * 3600_000).value));
  assert.ok(!validAdminCookie(undefined));
  assert.ok(checkPassword("correct horse battery"));
  assert.ok(!checkPassword("correct horse batter"));
});

test("confirm email escapes the competitor and carries the link", () => {
  const e = confirmEmail("<b>rival</b>.com", "free", "https://app.example/confirm?token=abc");
  assert.ok(!e.html.includes("<b>rival</b>"));
  assert.ok(e.html.includes("https://app.example/confirm?token=abc"));
  assert.ok(e.text.includes("https://app.example/confirm?token=abc"));
});

test("request → confirm claims exactly once; token is stored only as a hash", async () => {
  const { createRequest, confirmRequest, maskEmail } = await import("../src/lib/requests");
  const row = await createRequest({ email: "buyer@example.com", tier: "free", inputs: { competitorUrl: "rival.com" }, ip: "1.2.3.4", appUrl: "https://app.example" });
  assert.equal(row.status, "awaiting_confirmation");

  const sent = await (await fetch(`http://127.0.0.1:${RS_PORT}/__sent`)).json();
  const mail = sent.at(-1);
  assert.deepEqual(mail.to, ["buyer@example.com"]);
  assert.equal(mail.attachments.length, 0);
  const token = mail.text.match(/token=([A-Za-z0-9_-]+)/)[1];
  assert.notEqual(row.token_hash, token);

  assert.equal((await confirmRequest("nope-nope-nope-nope-nope")).status, "invalid");
  // Two clicks at the same time: only one gets to build.
  const [a, b] = await Promise.all([confirmRequest(token), confirmRequest(token)]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, ["already", "building"]);
  const built = (a.status === "building" ? a : b) as { status: "building"; row: { status: string; confirmed_at: string | null } };
  assert.equal(built.row.status, "building");
  assert.ok(built.row.confirmed_at);
  assert.equal(maskEmail("buyer@example.com"), "bu***@example.com");
});

test("a paid order row is created once and claimed once", async () => {
  const { ensureOrderRow, claim, getByOrderId } = await import("../src/lib/db");
  const base = { email: "p@example.com", tier: "pro" as const, inputs: { competitorUrl: "rival.com", stage: "new" as const, niche: "tea", audience: "offices" }, status: "awaiting_payment" as const, order_id: "order_TEST123", payment_id: "pay_TEST123" };
  await ensureOrderRow(base);
  await ensureOrderRow(base);
  const rows = await (await fetch(`http://127.0.0.1:${SB_PORT}/__rows`)).json();
  assert.equal(rows.filter((r: { order_id: string }) => r.order_id === "order_TEST123").length, 1);
  const first = await claim("order_id=eq.order_TEST123", ["awaiting_payment", "failed"]);
  const second = await claim("order_id=eq.order_TEST123", ["awaiting_payment", "failed"]);
  assert.ok(first);
  assert.equal(second, null);
  assert.equal((await getByOrderId("order_TEST123"))?.status, "building");
});
