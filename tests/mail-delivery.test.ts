import assert from "node:assert/strict";
import test from "node:test";
import { assertResendAccepted, htmlToPlainText, selectMailProvider } from "../src/lib/mail-delivery";

test("Resend is preferred when both mail providers have credentials", () => {
  assert.equal(selectMailProvider({ resendKey: "re_example", smtpReady: true }), "resend");
  assert.equal(selectMailProvider({ resendKey: "re_example", smtpReady: false }), "resend");
  assert.equal(selectMailProvider({ resendKey: "  ", smtpReady: true }), "smtp");
  assert.equal(selectMailProvider({ smtpReady: false }), null);
});

test("Provider selection can be overridden deliberately, without fallback on missing credentials", () => {
  assert.equal(selectMailProvider({ choice: "SMTP", resendKey: "re_test", smtpReady: true }), "smtp");
  assert.equal(selectMailProvider({ choice: "resend", smtpReady: true }), null);
  assert.equal(selectMailProvider({ choice: "smtp", resendKey: "re_test", smtpReady: false }), null);
  assert.throws(
    () => selectMailProvider({ choice: "suspicious", resendKey: "re_test", smtpReady: true }),
    /Invalid MAIL_PROVIDER/,
  );
});

test("Resend error objects fail visibly instead of appearing successful", () => {
  assert.throws(
    () => assertResendAccepted({ data: null, error: { name: "validation_error" } }),
    /Resend: validation_error/,
  );
  assert.throws(
    () => assertResendAccepted({ data: null, error: null }),
    /Resend: missing_delivery_id/,
  );
  assert.doesNotThrow(
    () => assertResendAccepted({ data: { id: "email_123" }, error: null }),
  );
});

test("Provider message contents are not echoed into errors or logs", () => {
  assert.throws(
    () => assertResendAccepted({ data: null, error: { name: "user@example.org secret_api_key" } }),
    (err: unknown) => err instanceof Error &&
      err.message === "Resend: provider_error" &&
      !err.message.includes("example.org"),
  );
});

test("HTML emails have readable plain-text equivalents and retain clickable links", () => {
  const html = `<div style="background:#eee">
    <span style="display:none!important;">Preview hidden</span>
    <h1>Bestellbestätigung 123</h1>
    <p>Hallo Jürg &amp; Familie</p>
    <p>Vielen Dank für deine Bestellung.</p>
    <table><tr><td>Teil A</td><td>CHF 19.00</td></tr></table>
    <p><a href="https://www.alps3dp.ch/account">Bestellstatus ansehen</a></p>
    <p>Falls Button nicht geht:<br/>https://www.alps3dp.ch/account</p>
  </div>`;
  const text = htmlToPlainText(html);
  assert.match(text, /Bestellbestätigung 123/);
  assert.match(text, /Hallo Jürg & Familie/);
  assert.match(text, /Teil A/);
  assert.match(text, /CHF 19.00/);
  assert.match(text, /Bestellstatus ansehen \(https:\/\/www\.alps3dp\.ch\/account\)/);
  assert.doesNotMatch(text, /Preview hidden|<td>|background:/);
});

test("Plain-text output doesn't render user-generated markup as HTML", () => {
  const text = htmlToPlainText('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(text.trim(), "<script>alert(1)</script>");
  // Text isn't interpreted as HTML by clients; no raw <script> is in the HTML template.
});
