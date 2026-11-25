# Alps3DP: Transactional mail setup and delivery checks

The shop uses one shared mailer in [`src/lib/mail.ts`](../src/lib/mail.ts). The same site logo, `/images/logo.jpeg`, is used in all HTML messages. Emails have a plain-text alternative and contain no inline SVG, marketing pixels or third-party fonts.

## 1. What gets sent, and to whom?

| Trigger | Customer receives | Shop management receives |
| --- | --- | --- |
| New registration | Welcome **and verification** combined into one email | No copy |
| Signed-in unverified customer requests a new link | Verification link | No copy |
| Successful password login | Security/login notice | No copy |
| Password forgotten | Single-use reset link (60 minutes) | No copy |
| Account email changed | Verification link for new email | No copy |
| Confirmed paid Stripe order | Order confirmation with items, delivery address and totals | **Always** `Alp.Kasemi@alps3Dp.ch`, plus a distinct `ADMIN_ORDER_EMAIL` |
| Contact form submitted | Acknowledgment of enquiry | **Always** `Alp.Kasemi@alps3Dp.ch`, plus a distinct `MAIL_SUPPORT_EMAIL` |

The designated manager email is explicitly configured in [`mail-recipients.ts`](../src/lib/mail-recipients.ts). It is attempted even when optional Vercel variables are missing or differ. If no separate support mailbox is configured, the manager is also the default support and Reply-To address. Matching addresses are compared case-insensitively, so the manager is not emailed twice. Every operator order recipient has a separate hashed Resend idempotency key.

**Privacy:** Password-reset URLs, verification tokens and login notifications are *not* forwarded to the manager. An operator notification contains only business data needed to handle the order or customer enquiry.

## 2. Resend and the verified domain

A real delivery test requires the sender domain to show **Verified** in [Resend Domains](https://resend.com/domains). Verify the actual domain used in `MAIL_FROM`, normally `alps3dp.ch`.

Publish *exactly* the DNS records Resend provides at the authoritative DNS provider. Check the DKIM record and any SPF / return-path CNAME or MX records shown in Resend. Do **not** overwrite existing mail MX records or add a second SPF TXT record at the same hostname. For a domain with no DMARC policy, a non-enforcing TXT policy such as `v=DMARC1; p=none` at `_dmarc.alps3dp.ch` is a reasonable starting point; do not replace an existing DMARC policy blindly.

After actual message-header tests confirm aligned SPF/DKIM/DMARC and legitimate sender inventory, the domain owner can consider gradually enforcing a stricter DMARC policy. Changing DNS does not itself guarantee that a message avoids spam filters. DNS and sender-domain status could not be independently read from the current connected infrastructure; the repository cannot prove live domain verification.

### How to test junk-folder placement

1. Send **controlled** registration, contact and paid-order test messages only to addresses you own. Use different recipient providers, ideally one Gmail and one Outlook/Microsoft mailbox, plus the actual shop manager mailbox.
2. In [Resend Emails](https://resend.com/emails), inspect each event for its real status: accepted, delivered, bounced, suppressed or rejected. An API message ID means the provider accepted a request, **not** that the mail reached an inbox.
3. In Gmail open the message's **Show original** view; in Outlook open **View message details / message source**. Inspect the `Authentication-Results` header. The expected result is `spf=pass`, `dkim=pass` and `dmarc=pass`, with the appropriate alignment to the visible `From:` domain. A mail can still land in junk despite all three passing.
4. Check both Inbox and Spam/Junk. Compare messages from the actual verified sender to a new test mailbox, verify that images load from your own domain, links open `https://www.alps3dp.ch`, and replies reach a working support mailbox.
5. If mail is bounced or rejected, act on the *specific* provider error. If accepted/delivered but classified as junk, review reputation, list/suppression status, domain age, message volume, authentication alignment, content and tracking choices. Avoid repeated high-volume test sends.

## 3. Required Vercel environment configuration

Set these on the **Alps3DP Vercel project**, Production environment. No API key should be committed into the repository or pasted into chat.

```dotenv
RESEND_API_KEY=<server-only secret already configured>
# MAIL_PROVIDER=resend            # Optional; Resend has priority automatically
MAIL_FROM=Alps3Dp <order@alps3dp.ch>

# Optional additional shop operations mailbox. The manager below always receives notifications.
ADMIN_ORDER_EMAIL=Alp.Kasemi@alps3Dp.ch
# Set to a real support mailbox that is monitored and can receive replies.
MAIL_SUPPORT_EMAIL=info@alps3dp.ch

NEXT_PUBLIC_APP_URL=https://www.alps3dp.ch
APP_URL=https://www.alps3dp.ch
```

These addresses are examples except the explicitly designated manager; only use `order@` and `info@` if those real mailboxes exist and the From domain is verified. If `ADMIN_ORDER_EMAIL` equals the manager address, only **one** manager copy is sent.

The existing `PUBLIC_APP_URL` variable is a supported fallback for the app base URL, but prefer `NEXT_PUBLIC_APP_URL` and `APP_URL`. A redeployment is required after changing production environment variables.

You may set `MAIL_BRAND_NAME`, `MAIL_ACCENT_COLOR` and `MAIL_FOOTER_TEXT` if needed. The logo is intentionally **always** the same first-party JPEG as the website; a separate `MAIL_LOGO_URL` / `MAIL_PRIMARY_COLOR` override no longer applies.

If you intentionally choose SMTP instead of Resend, set `MAIL_PROVIDER=smtp` and supply `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` and suitable port/secure settings. Use an authorized, matching sender address, especially with IONOS.

## 4. Minimalist mail layout

Messages use a white card, plain brand wordmark and actual JPEG logo, left-aligned title, a short relevant text, at most one clearly labeled primary button where needed, and a small footer with the website and support email. No decorative marketing paragraphs, giant gradients, large icons or generic AI-sounding slogans.

An order confirmation includes the order number, date, purchased products, quantities and prices, subtotal where available, shipping, total, delivery address, payment method where available, and a link to the customer account. The manager's copy includes the customer contact, matching order details and admin link. Contact messages include the sender, subject, body and Reply-To; the customer receives a short acknowledgment.

## 5. Safe acceptance tests

Use a preview/test environment and mailboxes that you own. Do not send real customer emails or charge live cards merely to validate mail.

1. **Registration:** Create one new test account. Verify the single combined welcome/verification email, working logo and plain-text fallback. Confirm verification links expire and work once.
2. **Verification resend:** While still unverified, request another link under Account → Sicherheit. Check the earlier link is invalidated; ensure only the signed-in account can trigger this action.
3. **Password reset:** Request reset twice for a test account. Only the newest link should work; previously issued sessions must be invalidated after the new password is applied.
4. **Login security:** Sign in after registration and confirm an ordinary login notice, not a duplicate welcome message.
5. **Support:** Submit a test contact request. Verify delivery to **`Alp.Kasemi@alps3Dp.ch`**, optionally the distinct support inbox, and the customer acknowledgment. Check Reply-To and all mailbox spam folders.
6. **Orders:** Use the admin Ops test-order tool only in a disposable environment (it writes test orders), or a **Stripe test-mode** checkout with a test card and matching test webhook. Verify one confirmation for the customer, one for the manager, plus a separate optional admin mailbox copy. Duplicate Stripe webhook delivery must not generate duplicate order mails.
7. **Failures:** In a test environment, simulate Resend 403/429/5xx and verify proper handling. Check app server logs, provider event statuses and retry procedures; do not reveal tokens or personal addresses in logs.
8. **External:** Confirm the real production Vercel deployment SHA, domain, sender and DKIM/SPF/DMARC headers from actual delivered test messages before marking the rollout verified.

The GitHub suite tests transport responses and route behavior using fake tokens, a fake in-memory database and signed *test-only* Stripe events. It does **not** send actual emails and cannot confirm inbox placement.

## 6. Important remaining limitations

- **No durable order-email outbox yet.** Paid orders are marked `PAID` by verified Stripe events before emails are sent. If the provider fails, every configured recipient is attempted, failure is logged, but a failed send is **not automatically retried**. A production-grade guarantee requires a durable queue/worker, individual delivery state and reviewed Prisma migration.
- An optional support inbox failure is logged, but the contact form succeeds when the manager's message was accepted, preventing unnecessary customer retries. The manager's own send failure is returned as an error. A manager acceptance is still not inbox delivery.
- Resend's idempotency keys help deduplicate attempts within the provider's supported window but are not a delivery guarantee. A manager's mailbox can still reject or filter a message.
- Rate limiting is process-local, not shared across all serverless instances. Production abuse controls should use centrally stored limits.
- Changing a customer's account email currently changes the stored address before verifying the new mailbox. If sending fails, the account can be left unverified, although a resend route exists. A pending-email confirmation model is recommended.
- The checkout route currently does **not** enforce a verified account email. This is a product policy gap, not a mail-delivery feature.

For tested scope and evidence, see [mail verification](MAIL_VERIFICATION.md), [production checklist](../PRODUCTION_CHECKLIST.md) and [changelog](../CHANGELOG.md).
