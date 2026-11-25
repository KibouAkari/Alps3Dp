import assert from "node:assert/strict";
import test from "node:test";

type Sent = { from: string; to: string; subject: string; html: string; text: string; reply_to?: string };
const sent: Sent[] = [];
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
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  assert.match(url, /^https:\/\/api\.resend\.com\/emails/);
  if (!init?.body) throw new Error("Missing JSON body");
  const data = JSON.parse(String(init.body)) as Sent;
  sent.push(data);
  return new Response(
    JSON.stringify(rejected
      ? { name: "validation_error", message: "Domain not verified" }
      : { id: `mock_${sent.length}` }),
    { status: rejected ? 403 : 200, headers: { "content-type": "application/json" } },
  );
}) as typeof fetch;

const mail = await import("../src/lib/mail");

test.after(() => { globalThis.fetch = originalFetch; });
test.beforeEach(() => { sent.length = 0; rejected = false; });

function assertBrandAndFallback(message: Sent) {
  assert.equal(message.from, "Alps3Dp <order@alps3dp.ch>");
  assert.match(message.html, /https:\/\/www\.alps3dp\.ch\/images\/logo\.jpeg/);
  assert.match(message.html, /Alps3Dp/);
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
  assert.equal(sent.length, 2);
  const [owner, customer] = sent;
  assert.equal(owner.to, "support@example.test");
  assert.equal(customer.to, "customer@example.test");
  assert.match(owner.html, /&lt;script&gt;/);
  assert.doesNotMatch(owner.html, /<script>/);
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
  assert.equal(sent.length, 2);
  assert.equal(sent[0].to, "buyer@example.test");
  assert.equal(sent[1].to, "owner@example.test");
  assert.match(sent[0].html, /CHF 49.90/);
  assert.match(sent[1].html, /Printed Item/);
  assert.match(sent[0].text, /Bestellstatus ansehen/);
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
  assert.deepEqual(sent.map(s => s.to), ["buyer@example.test", "owner@example.test"]);
});
