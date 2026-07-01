# Alp3D Shop Prototype

Professional prototype for a 3D-printed products ecommerce site (blue/black design) with shop browsing, filters, auth UI flows, checkout UI, and admin dashboard + monitoring.

## Included

- Next.js App Router + TypeScript + Tailwind
- Shop home with search, category filter, and price range filter
- Product detail page
- Auth UI pages: login, register, forgot password, reset password
- Account and cart pages
- Checkout UI with payment method selection
- Admin pages:
  - Dashboard summary
  - Product management form and table
  - Monitoring/analytics overview (revenue, purchases, clicks, top products)
- Real API routes for:
  - products CRUD (admin)
  - auth (register, login, logout, session, verify email)
  - forgot/reset password token flow
  - persistent cart
  - checkout + payment webhook
  - admin shipping settings
- Prisma schema for persistent Postgres storage
- Empty initial shop data (no products/categories/orders)

## Run

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env.local
```

Fill at least:
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- `RESEND_API_KEY` (optional but required for real emails)
- `MAIL_FROM`
- `ADMIN_ORDER_EMAIL`
- `STRIPE_SECRET_KEY` (required for card/TWINT)
- `STRIPE_WEBHOOK_SECRET` (required for webhook validation)
- `BLOB_READ_WRITE_TOKEN` (required for production image uploads)

3. Run database setup

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

After seeding, only the admin user and default shipping setting exist.
No products, no categories, and no analytics/order data are inserted.

4. Start development server

```bash
npm run dev
```

5. Open http://localhost:3000

## Key Routes

- `/` shop overview
- `/products/[slug]` product detail
- `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`
- `/account`
- `/cart`
- `/checkout`
- `/admin`, `/admin/products`, `/admin/analytics`

## Payment Recommendation (TWINT vs Credit Card)

For the easiest secure production setup: use Stripe as the primary payment layer.

- Why: fast integration, strong fraud/security tooling, webhook reliability, great docs
- TWINT: implemented through Stripe payment methods. Stripe account capability/region must allow TWINT.
- Minimum production flow:
  - create checkout session or payment intent
  - verify webhook signature
  - only mark orders as paid after verified webhook event
  - send emails after payment confirmation

## Email Flow Recommendation

Use Resend (or Postmark) with transactional templates:

- Admin email: order summary with customer, items, amounts, shipping address
- Customer email: payment confirmation + order summary
- Later: add invoice PDF generation and attach invoice number

## Production Security Checklist

- Use hashed passwords (bcrypt/argon2), never plain text
- Add role-based authorization for admin routes and APIs
- Validate all inputs server-side with schema validation (zod)
- Protect against CSRF/session hijacking and enforce secure cookies
- Enforce webhook signature verification
- Use parameterized ORM queries (Prisma) to avoid SQL injection
- Rate-limit login/reset endpoints
- Add audit logs for admin product changes

Implemented in this repo:

- Rate limits for `/api/auth/login`, `/api/auth/register`, `/api/password/forgot`, `/api/password/reset`, `/api/checkout`
- Global security headers (CSP, frame protection, MIME sniffing protection, permissions policy)
- Stripe webhook idempotency guard to avoid duplicate payment completion side effects
- Prisma-backed queries only (no raw SQL string interpolation used in API routes)

Remaining recommended hardening:

- Add distributed rate limiting (Redis/Upstash) for stronger multi-instance protection
- Add WAF rules at the edge (Vercel Firewall or Cloudflare)
- Add monitoring alerts for repeated failed logins and checkout spikes

## Next Integration Steps

1. Add Prisma Client and migrate schema to Vercel Postgres
2. Integrate NextAuth (credentials + optional OAuth)
3. Replace demo data with DB-backed queries and mutations
4. Integrate Stripe checkout + webhook order state updates
5. Implement password reset token table and email sender
6. Add real click tracking and order analytics tables

## Domain + Stripe + Email Go-Live Runbook

1. Verify production domain variables

- `NEXT_PUBLIC_APP_URL=https://alps3dp.ch`
- `APP_URL=https://alps3dp.ch`

2. Configure Stripe

- Add `STRIPE_SECRET_KEY`
- Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Add `STRIPE_WEBHOOK_SECRET`
- Configure webhook endpoint: `https://alps3dp.ch/api/webhooks/payment`
- Enable required payment methods in Stripe Dashboard (cards, TWINT if available in region)

3. Configure transactional mail

- Add `RESEND_API_KEY`
- Set verified sender in `MAIL_FROM` (for example `Alps3Dp <noreply@alps3dp.ch>`)
- Set `ADMIN_ORDER_EMAIL` for order notifications

4. Validate before launch

- Create a test order from checkout with Stripe test card
- Confirm webhook marks order as paid exactly once
- Confirm customer and admin order emails are delivered
- Confirm robots and sitemap are live:
  - `/robots.txt`
  - `/sitemap.xml`

## Performance Notes

- Homepage products are server-seeded to reduce first-load client waterfall
- Product API route uses revalidation for efficient cache behavior on list reads
- Images are configured for optimized Next.js delivery with remote allowlist

## Vercel Deployment

### Auto Deploy via GitHub

This project is connected to GitHub and Vercel. You do not need to deploy manually.

- Commit your changes
- Push to your connected branch (for example `main`)
- Vercel will build and deploy automatically

1. Link project

```bash
vercel link --project alps3dp
```

2. If you use Vercel Connected Storage (Prisma Postgres), install/connect it in Vercel.

The app now supports all of these environment variable names automatically:

- `DATABASE_URL`
- `Alps3Dp_DATABASE_URL`
- `Alps3Dp_PRISMA_DATABASE_URL`
- `Alps3Dp_POSTGRES_URL`
- `PRISMA_DATABASE_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`

If `DATABASE_URL` is not set, the app and seed process will fall back to the connected-storage variables above.

### Domain Setup (alps3dp.ch)

- Set `NEXT_PUBLIC_APP_URL=https://alps3dp.ch`
- Set `APP_URL=https://alps3dp.ch`
- In Resend, verify your sender domain and use `MAIL_FROM` on `@alps3dp.ch`
- In Stripe dashboard, set allowed redirect domain and webhook endpoint to `https://alps3dp.ch/api/webhooks/payment`

3. Set production environment variables in Vercel (if they are not already set by Connected Storage):

```bash
vercel env add DATABASE_URL production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add RESEND_API_KEY production
vercel env add MAIL_FROM production
vercel env add ADMIN_ORDER_EMAIL production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add APP_URL production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add ADMIN_EMAIL production
vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_NAME production
```

4. Run migrations and seed against production DB:

```bash
DATABASE_URL="<your-production-db-url>" npm run db:migrate
DATABASE_URL="<your-production-db-url>" npm run db:seed
```

5. Deploy:

```bash
vercel deploy --prod
```

6. Configure Stripe webhook to:

`https://<your-domain>/api/webhooks/payment`

and use the signing secret as `STRIPE_WEBHOOK_SECRET`.

## Environment

Copy `.env.example` to `.env.local` and fill all required keys.

## Product Image Uploads

- Admin can upload multiple product images via drag-and-drop in `/admin/products`
- Upload flow uses `/api/uploads`
- In production, images are stored in Vercel Blob (`BLOB_READ_WRITE_TOKEN`)
- In local development without Blob token, files are saved under `public/uploads`
- Product images still support external links as fallback

## Admin Bootstrap

An admin account is created by `npm run db:seed`.

- Email: value from `ADMIN_EMAIL` (default `admin@alps3dp.ch`)
- Password: value from `ADMIN_PASSWORD` (default `ChangeMe-Admin-2026!`)

Change these values before production use.
