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
- [ ] Customer order email is delivered
- [ ] Admin order email is delivered
- [ ] SPF/DKIM/DMARC are configured for production domain

## 5. Security

- [ ] TLS/HTTPS enforced in production
- [ ] Security headers are active
- [ ] Rate limiting is enabled for sensitive routes
- [ ] Admin routes require authorization
- [ ] Access logs and monitoring are enabled

## 6. Functional QA

- [ ] Registration/login/password reset tested
- [ ] Cart and checkout tested
- [ ] Test payment completed end-to-end
- [ ] Canceled/expired checkout flow tested
- [ ] Admin product updates tested

## 7. Operations

- [ ] Error monitoring configured (for example Sentry)
- [ ] Alerting in place for payment/webhook failures
- [ ] Rollback procedure documented
- [ ] On-call or ownership responsibilities are clear
