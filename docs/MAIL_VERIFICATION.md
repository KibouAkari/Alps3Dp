# Alps3DP transactional mail verification report

**Review date:** 25 November 2026  
**Source:** `KibouAkari/Alps3Dp`, pull request #3 (source follow-up to merged PR #2).  
**Scope:** Registration, email verification, resend, login security alert, password recovery, contact message, and paid Stripe order notifications.

## What is checked automatically

The GitHub Actions mail suite runs TypeScript typechecking, provider-selection tests, simulated Resend integration tests and in-memory API route tests. Mock provider responses exercise both acceptance and rejection without sending mail. The tests use fictitious `example.test` accounts, a fake PostgreSQL client, a fake Resend key and a signed Stripe *test-only* webhook event generated using a fake webhook secret.

| Flow | What is tested | Remaining verification |
| --- | --- | --- |
| New registration | Account creation, combined welcome+verification HTML/text, token link; API/UI distinguish provider acceptance and failure | Real mailbox delivery and verified sender domain |
| Verification | Link consumption and replay rejection, replacement/resend, email change; UI presents a resend option | Clicking links through live domain, accessibility on mobile |
| Login security | Successful login message and no duplicate welcome mail | Live provider acceptance and user inbox |
| Password reset | Generic request handling, latest-token-only, single use, password update and session revocation | Real reset mail, expiry boundary and live database transaction |
| Contact form | Operator notification plus customer acknowledgment, escaped submitted content | Both real inboxes, Reply-To, spam handling |
| Paid order | Signed Stripe test webhook, order PAID transition, two email notifications and duplicate webhook protection | Stripe live/test event delivery, real database, Resend dashboard and inboxes |
| Provider errors | Resend `{data,error}` and missing IDs are rejected; errors sanitized | API key permission, domain verification, real provider status |

The test suite confirms the **application logic under controlled assumptions**. It does not independently verify the external mail infrastructure.

## Live infrastructure limitation

The connected Vercel account exposed only LifeOrbit, not Alps3DP, during this review. The project, the actual values of `RESEND_API_KEY` and sender settings, production deployment, and Resend event history were therefore **not inspected**. From the available public browsing environment, `www.alps3dp.ch` did not open; that alone does not prove the website is down.

**Do not report that all emails are delivered or that checkout is production-safe on the strength of mocked tests.**

## Minimum controlled live acceptance

Perform this only after a reviewed deploy, with a newly registered test account and mailboxes under your control.

1. Confirm `alps3dp.ch` and the actual sender identity show *Verified* in Resend. Confirm SPF, DKIM and DMARC with your DNS host. Do not overwrite unrelated MX or existing records.
2. Confirm `MAIL_FROM`, `ADMIN_ORDER_EMAIL`, `MAIL_SUPPORT_EMAIL` and `NEXT_PUBLIC_APP_URL` or `APP_URL` in the correct Vercel Production environment. Do not expose secret values.
3. Register a new test account and verify the combined welcome/verification mail. Request resend while unverified. Confirm the old link is rejected and the newest link verifies the account.
4. Request a password reset twice; confirm only the newest link works, the new password signs in and the previous password/session no longer works.
5. Submit a contact form using a controlled mailbox; confirm the customer acknowledgment and operator request, including Reply-To.
6. Generate a **Stripe test-mode** purchase against a controlled test environment; check the webhook, PAID order, customer confirmation and operator order notice. Do not create a production paid order simply to test notifications.
7. In Resend check API accepted, delivered, bounced or suppressed states. A successful API response is not proof of inbox delivery.

## Remaining engineering risks

- Paid-order emails do **not** have a durable delivery outbox and retry worker. A provider outage after an order is marked PAID can lose a notification. Create this separately with a reviewed Prisma migration and queue.
- Current rate limiting is process-local; Vercel serverless instances do not share limits. Migrate to a centrally stored limiter for production-grade abuse controls.
- Changing the registered email currently switches the address before the new one is verified; a mail outage can strand the account. A staged pending-email model would be safer and requires a database migration.
- The registration and email-change UI only report that a message was accepted by the provider; they do not claim inbox delivery. An error after email change is explained without falsely claiming the database update failed.
- Email verification is not currently enforced during checkout. Do not imply that a confirmation email gates shopping until this policy is intentionally implemented and tested.
- Live domain, sender verification, provider permissions and mailbox delivery remain unconfirmed in this connected environment.

For configuration see [MAIL_SETUP.md](MAIL_SETUP.md) and [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md).
