import assert from "node:assert/strict";
import test from "node:test";

type Sent = { from: string; to: string; subject: string; html: string; text: string; reply_to?: string };
const sent: Sent[] = [];
const idempotencyKeys: Array<string | null> = [];
const originalFetch = globalThis.fetch;

process.env.RESEND_API_KEY = "re_local_fictional_test_only";
process.env.MAIL_PROVIDER = "resend";
process.env.MAIL_FROM = "Alps3Dp <order@alps3dp.ch>";
process.env.ADMIN_ORDER_EMAIL = "owner@example.test";
process.env.MAIL_SUPPORT_EMAIL = "support@example.test";
process.env.NEXT_PUBLIC_APP_URL = "https://www.alps3dp.ch";

// All fetches to Resend are intercepted. No credentials, emails or test orders
// are sent to any external provider or production services.
let rejected = false;
let rejectedRecipient: string | null = null;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  assert.match(url, /^https:\/\/api\.resend\.com\/emails/);
  if (!init?.body) throw new Error("Missing JSON body");
  const data = JSON.parse(String(init.body)) as Sent;
  sent.push(data);
  idempotencyKeys.push(new Headers(init.headers).get("idempotency-key"));
  const fail = rejected || rejectedRecipient === data.to;
  return new Response(
    JSON.stringify(fail
      ? { name: "validation_error", message: "Domain not verified" }
      : { id: `mock_${sent.length}` }),
    { status: fail ? 403 : 200, headers: { "content-type": "application/json" } },
  );
}) as typeof fetch;

let mail: typeof import("../src/lib/mail");
test.before(async () => { mail = await import("../src/lib/mail"); });

test.after(() => { globalThis.fetch = originalFetch; });
test.beforeEach(() => { sent.length = 0; idempotencyKeys.length = 0; rejected = false; rejectedRecipient = null; });

function assertBrandAndFallback(message: Sent) {
  assert.equal(message.from, "Alps3Dp <order@alps3dp.ch>");
  assert.match(message.html, /https:\/\/www\.alps3dp\.ch\/images\/logo\.jpeg/);
  assert.match(message.html, /Alps3Dp/);
  assert.doesNotMatch(message.html, /linear-gradient|text-transform:uppercase|float|animation:/);
  assert.match(message.html, /border-bottom:1px solid #e5e7eb/);
  assert.ok(message.text.length > 50, "Plain text missing");
  assert.doesNotMatch(message.text, /<table|<img|style=/);
}

test("Registration combines welcome and verifiable link into one email", async () => {
  await mail.sendWelcomeVerifyEmail({
    to: "registered@example.test",
    name: "A & B <script>",
    verifyUrl: "https://www.alps3dp.ch/api/auth/verify-email?token=fake-test-token",
  });
  assert.equal(sent.length, 1);
  const email = sent[0];
  assert.equal(email.to, "registered@example.test");
  assert.match(email.subject, /Willkommen.*bestätigen/);
  assert.match(email.html, /A &amp; B &lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /verify-email\?token=fake-test-token/);
  assertBrandAndFallback(email);
});

test("Verification and password reset carry correct URLs and expiry", async () => {
  await mail.sendVerifyEmail("changed@example.test", "https://www.alps3dp.ch/api/auth/verify-email?token=test");
  await mail.sendPasswordResetEmail("reset@example.test", "https://www.alps3dp.ch/auth/reset-password?token=test");
  assert.equal(sent.length, 2);
  assert.match(sent[0].text, /verify-email\?token=test/);
  assert.match(sent[1].text, /reset-password\?token=test/);
  assert.match(sent[1].html, /60 Minuten/);
  sent.forEach(assertBrandAndFallback);
});

test("Login warning is distinct from onboarding email", async () => {
  await mail.sendLoginSuccessEmail("login@example.test");
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Neue Anmeldung/);
  assert.match(sent[0].text, /Passwort/);
  assertBrandAndFallback(sent[0]);
});

test("Support sends owner request plus customer acknowledgment", async () => {
  await mail.sendContactMessage({
    firstName: "Alex", lastName: "Tester", email: "customer@example.test",
    subject: "Frage <script>unsafe</script>", message: "Hallo\nWie funktioniert das?",
  });
  assert.equal(sent.length, 3);
  const [manager, support, customer] = sent;
  assert.equal(manager.to, "Alp.Kasemi@alps3Dp.ch");
  assert.equal(support.to, "support@example.test");
  assert.equal(customer.to, "customer@example.test");
  assert.match(manager.html, /&lt;script&gt;/);
  assert.doesNotMatch(manager.html, /<script>/);
  assert.match(customer.text, /Hallo/);
  sent.forEach(assertBrandAndFallback);
});

test("Order sends both customer and operator notifications", async () => {
  await mail.sendOrderEmails({
    orderId: "order-test-123",
    orderNumber: 501,
    customerName: "Test User",
    customerEmail: "buyer@example.test",
    totalCents: 4990, subtotalCents: 4990, shippingCents: 0,
    paymentMethod: "CARD",
    createdAt: new Date("2026-11-25T10:00:00.000Z"),
    shipping: { address1: "Teststrasse 2", zip: "8000", city: "Zürich", country: "CH" },
    lines: [{ title: "Printed Item", quantity: 1, unitCents: 4990 }],
  });
  assert.equal(sent.length, 3);
  assert.deepEqual(sent.map(s => s.to),
    ["buyer@example.test", "Alp.Kasemi@alps3Dp.ch", "owner@example.test"]);
  assert.notEqual(idempotencyKeys[1], idempotencyKeys[2],
    "Distinct operator recipients must not share a Resend dedupe key");
  assert.ok(idempotencyKeys[1]?.startsWith("order-operator/"));
  assert.ok(idempotencyKeys[2]?.startsWith("order-operator/"));
  assert.match(sent[0].html, /CHF 49.90/);
  assert.match(sent[1].html, /Printed Item/);
  assert.match(sent[0].text, /Bestellung ansehen/);
  assert.match(sent[0].text, /Zwischensumme/);
  sent.forEach(assertBrandAndFallback);
});

test("Provider rejection propagates to caller, not reported as a successful email", async () => {
  rejected = true;
  await assert.rejects(
    mail.sendPasswordResetEmail("reset@example.test", "https://www.alps3dp.ch/auth/reset-password?token=test"),
    /E-Mail konnte nicht versendet werden/,
  );
  assert.equal(sent.length, 1);
});

test("Even if customer order email is rejected, the operator send is attempted", async () => {
  rejected = true;
  await assert.rejects(mail.sendOrderEmails({
    orderId: "order-fail-321", orderNumber: 321,
    customerName: "Test", customerEmail: "buyer@example.test",
    totalCents: 1000,
    lines: [{ title: "Part", quantity: 1, unitCents: 1000 }],
  }), /One or more order notifications/);
  assert.deepEqual(sent.map(s => s.to),
    ["buyer@example.test", "Alp.Kasemi@alps3Dp.ch", "owner@example.test"]);
});

test("Operator addresses are always included even if optional env is missing", async () => {
  const existing = process.env.ADMIN_ORDER_EMAIL;
  delete process.env.ADMIN_ORDER_EMAIL;
  try {
    await mail.sendOrderEmails({
      orderId: "order-fallback-222", orderNumber: 222,
      customerName: "Test", customerEmail: "buyer@example.test",
      totalCents: 1000,
      lines: [{ title: "Part", quantity: 1, unitCents: 1000 }],
    });
    assert.deepEqual(sent.map(s => s.to),
      ["buyer@example.test", "Alp.Kasemi@alps3Dp.ch"]);
  } finally {
    process.env.ADMIN_ORDER_EMAIL = existing;
  }
});

test("Operator and support recipient equal to manager are not sent twice", async () => {
  const oldSupport = process.env.MAIL_SUPPORT_EMAIL;
  try {
    process.env.MAIL_SUPPORT_EMAIL = "alp.kasemi@ALPS3DP.CH";
    await mail.sendContactMessage({
      firstName: "Lara", lastName: "Test", email: "buyer@example.test",
      subject: "Frage", message: "Hallo",
    });
    assert.deepEqual(sent.map(s => s.to),
      ["Alp.Kasemi@alps3Dp.ch", "buyer@example.test"]);
  } finally {
    process.env.MAIL_SUPPORT_EMAIL = oldSupport;
  }
});

test("When no separate support mailbox exists, only the shop manager is notified", async () => {
  const oldSupport = process.env.MAIL_SUPPORT_EMAIL;
  const oldAdmin = process.env.ADMIN_ORDER_EMAIL;
  delete process.env.MAIL_SUPPORT_EMAIL;
  delete process.env.ADMIN_ORDER_EMAIL;
  try {
    await mail.sendContactMessage({
      firstName: "Test", lastName: "Person", email: "customer@example.test",
      subject: "Frage", message: "Hallo",
    });
    assert.deepEqual(sent.map(s => s.to),
      ["Alp.Kasemi@alps3Dp.ch", "customer@example.test"]);
  } finally {
    process.env.MAIL_SUPPORT_EMAIL = oldSupport;
    process.env.ADMIN_ORDER_EMAIL = oldAdmin;
  }
});

test("A failed optional support copy does not force the customer to resubmit", async () => {
  rejectedRecipient = "support@example.test";
  await mail.sendContactMessage({
    firstName: "Test", lastName: "Person", email: "customer@example.test",
    subject: "Frage", message: "Hallo",
  });
  assert.deepEqual(sent.map(s => s.to),
    ["Alp.Kasemi@alps3Dp.ch", "support@example.test", "customer@example.test"]);
});

test("A failed primary shop-manager copy is reported even if support receives it", async () => {
  rejectedRecipient = "Alp.Kasemi@alps3Dp.ch";
  await assert.rejects(
    mail.sendContactMessage({
      firstName: "Test", lastName: "Person", email: "customer@example.test",
      subject: "Frage", message: "Hallo",
    }),
    /Shop manager did not receive/,
  );
  assert.deepEqual(sent.map(s => s.to),
    ["Alp.Kasemi@alps3Dp.ch", "support@example.test", "customer@example.test"]);
});
