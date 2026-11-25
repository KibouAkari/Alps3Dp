# Production Checklist

Use this checklist before launching to production.

## 1. Environment And Secrets

- [ ] No secrets are committed to the repository
- [ ] `.env.local` is local-only and ignored by Git
- [ ] Production secrets are configured in Vercel
- [ ] `NEXTAUTH_SECRET` is long and random
- [ ] `DATABASE_URL` points to production database

## 2. Database

- [ ] Migration plan is reviewed
- [ ] Production migrations are executed intentionally
- [ ] Seeding is disabled for standard production builds
- [ ] Backups are configured

## 3. Payments (Stripe)

- [ ] `STRIPE_SECRET_KEY` is set for correct mode (test/live)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` matches the same mode
- [ ] `STRIPE_WEBHOOK_SECRET` is set
- [ ] Webhook endpoint is configured: `/api/webhooks/payment`
- [ ] Successful payment updates order status to `PAID`
- [ ] Duplicate webhook deliveries do not duplicate side effects

## 4. Email Delivery

- [ ] Mail provider is configured (SMTP or Resend)
- [ ] Sender domain is verified
- [ ] Welcome, email verification, password reset and login notices display info@alps3dp.ch (or configured MAIL_FROM_ACCOUNT) as From
- [ ] Contact enquiries and acknowledgments display info@alps3dp.ch (or configured MAIL_FROM_SUPPORT) as From
- [ ] Customer and operator order emails display order@alps3dp.ch (or configured MAIL_FROM_ORDER) as From; test replies and SMTP send-as permission
- [ ] Customer order email is delivered
- [ ] A failed customer order email still triggers the operator notification attempt
- [ ] Shop-manager order email is delivered to `Alp.Kasemi@alps3Dp.ch`
- [ ] If a separate `ADMIN_ORDER_EMAIL` is set, it independently receives an order copy without duplicates when equal to manager
- [ ] Support enquiry goes to the manager and any different support inbox; customer receives acknowledgement
- [ ] Missing optional support mailbox still sends to the manager; optional support rejection does not incorrectly fail a successfully accepted manager enquiry
- [ ] SPF/DKIM/DMARC pass and align for the actual sending domain; Resend reports Verified
- [ ] Test delivery in Gmail and Outlook or other actual recipient providers with raw headers showing SPF/DKIM/DMARC pass and no junk/quarantine
- [ ] Check spam/junk, Resend bounce/suppression history and message content; inbox placement is not guaranteed by passing DNS checks
- [ ] `MAIL_FROM` is a verified, replyable sending address and all configured operational recipients are real mailboxes
- [ ] Manager mailbox `Alp.Kasemi@alps3Dp.ch` exists, receives mail and is checked by the operator
- [ ] Customer and manager test emails appear in Resend delivery logs and controlled mailboxes
- [ ] Duplicate Stripe webhook creates no additional order notifications, and each configured operator destination has a distinct Resend idempotency key
- [ ] `NEXT_PUBLIC_APP_URL` and `APP_URL` point at the canonical site; first-party logo `/images/logo.jpeg` and links work, including when images are blocked
- [ ] Order-email failure recovery is documented; no durable retry queue exists yet

## 5. Security

- [ ] TLS/HTTPS enforced in production
- [ ] Security headers are active
- [ ] Rate limiting is enabled for sensitive routes
- [ ] Admin routes require authorization
- [ ] Access logs and monitoring are enabled

## 6. Functional QA

- [ ] Registration and email verification, verified-account login notification and password reset tested with controlled mailboxes
- [ ] Unverified accounts can request a new verification email; links become invalid after use, replacement or email change
- [ ] Password reset consumes a token once, invalidates earlier reset links and revokes all signed-in sessions
- [ ] Contact-form owner and customer messages delivered
- [ ] Cart and checkout tested
- [ ] Test payment completed end-to-end
- [ ] Canceled/expired checkout flow tested
- [ ] Admin product updates tested

## 7. Operations

- [ ] Error monitoring configured (for example Sentry)
- [ ] Alerting in place for payment/webhook failures
- [ ] Rollback procedure documented
- [ ] On-call or ownership responsibilities are clear
