# Alps3DP transactional mail verification report

**Review date:** 25 November 2026  
**Source:** `KibouAkari/Alps3Dp`, merged PR #2 and PR #3, plus proposed PR #4. Copilot fix commit `6ed8f959`.  
**Scope:** Registration, email verification, resend, login security alert, password recovery, contact message, and paid Stripe order notifications.

## What is checked automatically

The GitHub Actions mail suite runs TypeScript typechecking, provider-selection tests, simulated Resend integration tests, shop-manager routing tests, in-memory API route tests and an isolated Next.js production build. Mock provider responses exercise both acceptance and rejection without sending mail. The tests use fictitious `example.test` accounts, a fake PostgreSQL client, a fake Resend key and a signed Stripe *test-only* webhook event generated using a fake webhook secret.

| Flow | What is tested | Remaining verification |
| --- | --- | --- |
| New registration | Account creation, combined welcome+verification HTML/text, token link; API/UI distinguish provider acceptance and failure | Real mailbox delivery and verified sender domain |
| Verification | Link consumption and replay rejection, replacement/resend, email change; UI presents a resend option | Clicking links through live domain, accessibility on mobile |
| Login security | Successful login message and no duplicate welcome mail | Live provider acceptance and user inbox |
| Password reset | Generic request handling, latest-token-only, single use, password update and session revocation | Real reset mail, expiry boundary and live database transaction |
| Contact form | Manager notification, separate optional support copy and customer acknowledgment, escaped submitted content; manager fallback when support unset; optional-copy failure does not force customer to retry | Real manager and support inboxes, Reply-To, spam handling |
| Paid order | Signed Stripe test webhook, order PAID transition, customer mail, manager and distinct optional admin copies, recipient-specific dedupe keys and duplicate webhook handling | Stripe test event delivery, real database, Resend dashboard and actual manager inbox |
| Provider errors | Resend `{data,error}` and missing IDs are rejected; errors sanitized | API key permission, domain verification, real provider status |

The latest completed automated run on the PR #4 branch passed **23 of 23 mail tests**, the TypeScript check and the isolated Next.js production build (GitHub Actions run `45623309360`). The newest tests also cover missing support configuration and partial provider failures for the manager versus an additional support mailbox. That run included the shop-manager routing changes and minimized email template. The test suite confirms the **application logic under controlled assumptions**. It does not independently verify the external mail infrastructure.

## Copilot security review (25 November 2026)

PR #3 was reviewed by GitHub Copilot, which identified two actual concurrency hazards. Both were fixed before merging:

1. Email address changes, verification resends and one-time token consumption now use transactions and a shared `lockUserForUpdate` PostgreSQL user-row lock. This prevents a valid old-address token from verifying a newly configured address in parallel with a resend.
2. Concurrent password-reset requests also serialize token replacement on the user row; only the latest reset link remains valid even under concurrent requests.

The merged fix is commit `6ed8f959`; tests explicitly exercise concurrent token operations. This review covers those changes and does not revert them.

## Operator routing and minimal design

The manager `Alp.Kasemi@alps3Dp.ch` is an explicit operations recipient for **every paid-order notification** and **every contact-form enquiry**. It is included even when Vercel options are missing; the optional shop-support or operations mailboxes receive separate deduplicated copies. Account recovery, welcome-verification URLs and login security messages remain private to the customer. The mail layout reuses the actual website logo and removes the previous decorative gradient.

The code attempts each delivery independently and uses recipient-specific Resend order idempotency keys. It cannot guarantee the manager receives mail when the provider, DNS or recipient mailbox fails.

## Live infrastructure limitation

The connected Vercel account exposed only LifeOrbit, not Alps3DP, during this review. The project, the actual values of `RESEND_API_KEY` and sender settings, production deployment, and Resend event history were therefore **not inspected**. From the available public browsing environment, `www.alps3dp.ch` did not open; that alone does not prove the website is down.

**Do not report that all emails are delivered or that checkout is production-safe on the strength of mocked tests.**

## Minimum controlled live acceptance

Perform this only after a reviewed deploy, with a newly registered test account and mailboxes under your control.

1. Confirm `alps3dp.ch` and the actual sender identity show *Verified* in Resend. Confirm SPF, DKIM and DMARC with your DNS host. Do not overwrite unrelated MX or existing records.
2. Confirm `MAIL_FROM`, optional `ADMIN_ORDER_EMAIL`, `MAIL_SUPPORT_EMAIL` and `NEXT_PUBLIC_APP_URL` or `APP_URL` in the correct Vercel Production environment. The manager's fixed destination is `Alp.Kasemi@alps3Dp.ch`; verify that mailbox exists and accepts mail. Do not expose secret values.
3. Register a new test account and verify the combined welcome/verification mail. Request resend while unverified. Confirm the old link is rejected and the newest link verifies the account.
4. Request a password reset twice; confirm only the newest link works, the new password signs in and the previous password/session no longer works.
5. Submit a contact form using a controlled mailbox; confirm the customer acknowledgment, **manager** request and any distinct support inbox copy, including Reply-To.
6. Generate a **Stripe test-mode** purchase against a controlled test environment; check the webhook, PAID order, customer confirmation, required manager notice and optional distinct admin copy. Do not create a production paid order simply to test notifications.
7. In Resend check accepted, delivered, bounced or suppressed states. Check Gmail and Outlook actual message headers for SPF/DKIM/DMARC alignment and both Inbox and Junk folders. A successful API response or authenticated DNS is not proof of inbox placement.

## Remaining engineering risks

- Paid-order emails do **not** have a durable delivery outbox and retry worker. A provider outage after an order is marked PAID can lose a notification. Create this separately with a reviewed Prisma migration and queue.
- Current rate limiting is process-local; Vercel serverless instances do not share limits. Migrate to a centrally stored limiter for production-grade abuse controls.
- Changing the registered email currently switches the address before the new one is verified; a mail outage can strand the account. A staged pending-email model would be safer and requires a database migration.
- The registration and email-change UI only report that a message was accepted by the provider; they do not claim inbox delivery. An error after email change is explained without falsely claiming the database update failed.
- SMTP and Resend acceptances are not durable proof of delivery; manager mail is only guaranteed to be **attempted**, not received.
- Email verification is not currently enforced during checkout. Do not imply that a confirmation email gates shopping until this policy is intentionally implemented and tested.
- Live domain, sender verification, provider permissions and mailbox delivery remain unconfirmed in this connected environment.

For configuration see [MAIL_SETUP.md](MAIL_SETUP.md) and [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md).
