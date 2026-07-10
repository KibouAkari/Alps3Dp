# Alp3D Shop

Alp3D Shop is a production-oriented ecommerce project for 3D-printed products.
It is built to cover the full customer flow: product discovery, cart, checkout, payment, account management, and operational admin tooling.

## Purpose

The goal of this repository is to provide a clean and extensible foundation for a modern online shop:

- Clear separation between UI, API routes, and business logic
- Practical payment and email flows for real order handling
- Safe defaults for authentication, rate limiting, and server-side validation
- Deployment-ready setup for Vercel + Postgres + Stripe

## What The Website Can Do

### Storefront

- Browse products with categories and filters
- Open product detail pages with image gallery
- Add products to cart and proceed to checkout

### Customer Account

- Register, login, logout, and password reset flows
- Basic account area for customer data
- Saved shipping addresses and saved payment method references

### Checkout And Orders

- Create orders from cart items
- Support invoice/prepayment flow
- Support Stripe card/TWINT checkout flow
- Persist order status and line items in the database
- Mark paid orders via Stripe webhook events

### Operational Features

- Admin routes and tools for product management
- Shipping configuration support
- Stripe status overview endpoint
- Order email notifications for customer and admin

## Tech Stack

- Next.js 15 (App Router)
- React 19 + TypeScript
- Prisma ORM
- PostgreSQL
- Stripe (Checkout + Webhooks)
- Resend or SMTP (transactional emails)
- Tailwind CSS
- Vercel deployment

## Project Structure

- `src/app` - pages and API routes
- `src/components` - reusable UI components
- `src/lib` - business logic and integrations
- `prisma` - schema and seed scripts
- `public` - static files

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create local environment file

```bash
cp .env.example .env.local
```

3. Configure required variables in `.env.local`

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

4. Prepare database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Start development server

```bash
npm run dev
```

## Payments And Email Flow

### Stripe

- Checkout sessions are created server-side in `/api/checkout`
- Successful payment is confirmed through `/api/webhooks/payment`
- Orders are marked as paid only after verified webhook processing

### Email

- Transactional email is sent through SMTP (if configured) or Resend
- Customer receives order confirmation
- Admin receives new order notification (when `ADMIN_ORDER_EMAIL` is set)

## Production Readiness Notes

This repository includes core production building blocks, but deployment quality depends on infrastructure setup and operations discipline.

Already in place:

- Server-side schema validation
- Session-aware checkout
- Rate limiting on sensitive endpoints
- Stripe webhook signature verification
- Idempotent payment completion handling
- Security headers middleware

Before go-live:

- Store all secrets in Vercel environment settings only
- Rotate credentials if any token was ever exposed
- Configure Stripe webhook endpoint in live mode
- Verify mail sender domain and delivery
- Run migration strategy intentionally (do not auto-seed production during build)
- Perform end-to-end test order in Stripe test mode and live mode

See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for a practical release checklist.

## Scripts

- `npm run dev` - start local development
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run typecheck` - run TypeScript checks
- `npm run db:generate` - generate Prisma client
- `npm run db:migrate` - apply Prisma migrations
- `npm run db:seed` - seed initial data

## Repository Standards

- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- License: [LICENSE](LICENSE)

## License

MIT License.
