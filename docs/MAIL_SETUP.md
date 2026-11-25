# Alps3DP transactional email setup

All transactional email templates use the same production branding from `src/lib/mail.ts`, including the real logo at `/images/logo.jpeg`. Outbound email is not enabled merely by setting an API key: the sending domain, sender, recipients and Vercel environment must also be correct.

## Email flows already available

| Event | Customer | Shop operator | Trigger |
| --- | --- | --- | --- |
| Registration | Combined welcome + email verification link | No | Successful new registration |
| Later password logins | Login security alert | No | Successful password login (welcome is sent at registration) |
| Verification email resend | Verification link | No | Signed-in unverified user requests another link in Account → Sicherheit |
| Password forgotten | Single-use reset link | No | Forgot-password request |
| Email address change | Verify new email | No | Authenticated email-change request |
| Successful paid Stripe checkout | Order confirmation | Order notification | Verified paid Stripe webhook |
| Contact form | Receipt confirmation | New contact message | Valid form submission |

Important: checkout email verification is currently not enforced; changing this is a separate payment/account-policy decision.

## 1. Finish Resend domain verification

1. Open [Resend Domains](https://resend.com/domains) and add the **actual sending domain**, normally `alps3dp.ch`.
2. Publish the precise DNS records supplied by Resend in the authoritative DNS provider. These typically include DKIM and a sending/return-path subdomain. Verify SPF and DMARC for the actual From domain; do not create a duplicate SPF TXT record.
3. Wait until Resend shows the sending domain as **Verified**. DNS propagation is outside the application's control.
4. Preserve your existing MX records and unrelated website DNS. Do not replace root SPF, MX or nameservers blindly.
5. An initial `_dmarc.alps3dp.ch` TXT monitoring policy such as `v=DMARC1; p=none` is reasonable **only if no existing DMARC record is present**. Review alignment and delivery results before switching to `quarantine` or `reject`.

Only the DNS owner can finish this step. The GitHub repository alone cannot verify the domain.

## 2. Configure Vercel production settings

These settings are added in **Vercel → Alps3DP project → Settings → Environment Variables**. Never paste API keys into source files, issues, support messages or screenshots.

```env
# Existing; secret / server-only
RESEND_API_KEY=<already configured>
# Default is Resend whenever RESEND_API_KEY is set, even if old SMTP vars remain.
# MAIL_PROVIDER=resend                  # Optional explicit override

# Sender domain must be verified in your Resend account
MAIL_FROM=Alps3Dp <order@alps3dp.ch>
# These inboxes must actually be able to receive mail
ADMIN_ORDER_EMAIL=order@alps3dp.ch
MAIL_SUPPORT_EMAIL=info@alps3dp.ch

NEXT_PUBLIC_APP_URL=https://www.alps3dp.ch
APP_URL=https://www.alps3dp.ch
```

The above addresses match historical repository examples; confirm which real mailboxes the shop owner operates. For a different verified domain, change `MAIL_FROM` accordingly. Do not use `noreply@` if you expect customer replies.

`MAIL_FROM` defaults to `Alps3Dp <order@alps3dp.ch>` for Resend when unset, so verifying the correct domain can unblock the first message without another setting. Nevertheless, explicitly setting the correct sender is recommended. `ADMIN_ORDER_EMAIL` is required for **owner order notifications**; without it, only the customer confirmation is attempted. `MAIL_SUPPORT_EMAIL` is the contact-form inbox and Reply-To.

The application reads `NEXT_PUBLIC_APP_URL` first, then `APP_URL`; `PUBLIC_APP_URL` is now accepted as a compatibility fallback (useful when migrating from LifeOrbit), but **set `NEXT_PUBLIC_APP_URL` or `APP_URL` for the normal Alps3DP configuration**. Use the canonical domain actually reachable by customers. Both local and production changes require a deployment restart.

## 3. Provider selection, error handling and plain text

The default provider is **Resend if `RESEND_API_KEY` exists**; otherwise SMTP is selected when all SMTP credentials exist. The optional `MAIL_PROVIDER=resend|smtp` selects explicitly. A failed Resend send does **not** silently fall back to SMTP.

The SDK returns `{ data, error }`. The mailer explicitly checks `error` and `data.id` and fails on rejection instead of silently reporting success. Logs carry sanitized provider error names, not full payloads, recipients, reset tokens or API credentials. Each email now includes a readable `text` alternative alongside the branded HTML.

The default logo URL is `${NEXT_PUBLIC_APP_URL}/images/logo.jpeg`. This is hosted on the sending website instead of a third party, with an alt-text fallback when images are blocked. The templates use inline CSS, a compact white/blue design and no inline SVGs.

You can customize `MAIL_BRAND_NAME`, `MAIL_LOGO_URL`, `MAIL_PRIMARY_COLOR`, `MAIL_ACCENT_COLOR` and `MAIL_FOOTER_TEXT` without touching code.

### SMTP alternative

SMTP works when `RESEND_API_KEY` is absent, or when `MAIL_PROVIDER=smtp` is explicitly selected and `SMTP_HOST`, `SMTP_USER` and `SMTP_PASSWORD` are configured. For IONOS, use the exact authenticated `SMTP_USER` as sender address, and an appropriate port/security setting such as 587 with STARTTLS. Do not store SMTP secrets in Git.

## 4. Test safely, without charging customers

Do not send to real customers for testing. Use mailboxes under your control.

1. Open the contact form and confirm that both the owner and customer receive their intended messages.
2. Register a **new** test account and verify that welcome and verification link arrive. Existing accounts do not trigger the registration mail again.
3. Request a password-reset email for your own test account and confirm expiration and one-time use.
4. Use the admin Ops test-order feature to send test order emails without a real payment. This creates test order records, so use only in a disposable test environment.
5. Test a Stripe **test-mode** payment end to end, checking webhook processing and payment email notifications. Do not use live cards or a real purchase.
6. Inspect [Resend Emails](https://resend.com/emails) and [API Logs](https://resend.com/logs) for accepted, delivered, bounced, rejected, suppressed and failed events. API acceptance does not guarantee inbox delivery.
7. Repeat after any sender-domain or deployment changes. Check spam folders and header SPF/DKIM/DMARC alignment.

## 5. Reliability caveats and recovery

- The Stripe webhook marks an order **PAID** before sending its customer and operator emails. Both recipient sends are attempted independently. If either provider send fails, current code logs the problem but there is **no durable automatic retry queue**. A paid order still exists and must be reconciled and emailed safely. Never mark it unpaid just to retry a notification.
- The newly added Resend idempotency keys for customer and operator order emails reduce duplicate provider sends within Resend's documented 24-hour window. SMTP does not support this provider-level guarantee.
- Login notifications are sent after successful password logins; unexpected volume should be monitored.
- Password-reset requests intentionally return generic responses to avoid account enumeration even on provider failure. Only the latest pending reset token is valid; tokens are consumed with an atomic conditional write, and old sessions are revoked after reset.
- Previously issued email-verification links are invalidated when the account email address changes. A signed-in unverified user can request a new verification link with an account/IP-limited endpoint; the destination cannot be chosen arbitrarily.
- Email change currently updates the account before attempting verification delivery; a provider outage can strand an unverified new address. Fixing this requires a separate staged email-change workflow.
- For reliably retried business-critical emails, add a durable mail outbox and a worker **with a reviewed database migration and rollback plan**, not detached serverless promises. This is a release requirement before claiming guaranteed order-email delivery.

## 6. Diagnostics

| Symptom | Check |
| --- | --- |
| Resend shows no API request | Deployment/version, server-side secret target, selected provider, function logs |
| Resend rejected the API call | Exact sender domain verification and permissions, API key validity, sanitized error code |
| API accepted but recipient has nothing | Resend delivery/bounce/suppression history and recipient spam/quarantine |
| Wrong provider used | `MAIL_PROVIDER`; Resend takes priority by default when key is present |
| Broken links or missing logo | `NEXT_PUBLIC_APP_URL`, `APP_URL` and public `/images/logo.jpeg` |
| Order confirmation missing | Stripe webhook/payment state, provider status, and absence of durable retry |
| Only customer received an order message | `ADMIN_ORDER_EMAIL` configuration and owner-send logs |

See [Production checklist](../PRODUCTION_CHECKLIST.md), [README](../README.md), and [Changelog](../CHANGELOG.md).
