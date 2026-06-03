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
- `RESEND_API_KEY` (optional but required for real emails)
- `MAIL_FROM`
- `ADMIN_ORDER_EMAIL`
- `STRIPE_SECRET_KEY` (required for card/TWINT)
- `STRIPE_WEBHOOK_SECRET` (required for webhook validation)

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

## Next Integration Steps

1. Add Prisma Client and migrate schema to Vercel Postgres
2. Integrate NextAuth (credentials + optional OAuth)
3. Replace demo data with DB-backed queries and mutations
4. Integrate Stripe checkout + webhook order state updates
5. Implement password reset token table and email sender
6. Add real click tracking and order analytics tables

## Vercel Deployment

1. Link project

```bash
vercel link --project alps3dp
```

2. Create or connect a Postgres database (Neon, Vercel Postgres, Supabase, Railway, etc.) and copy the connection string.

3. Set production environment variables in Vercel:

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

## Admin Bootstrap

An admin account is created by `npm run db:seed`.

- Email: value from `ADMIN_EMAIL` (default `admin@alps3dp.ch`)
- Password: value from `ADMIN_PASSWORD` (default `ChangeMe-Admin-2026!`)

Change these values before production use.
