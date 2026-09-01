# Alp3D Shop

<p align="center"><img src="public/images/logo.jpeg" alt="Alp3D Shop Logo" width="72"></p>

Alp3D Shop is an ecommerce website for 3D-printed products, designed to feel straightforward for customers and practical for operators. It combines product browsing, account management, checkout, payments, and order communication in one coherent flow.

The main goal of this repository is to provide a clean foundation for a real online shop. It is more than a UI prototype: it includes server routes, database models, payment integration, and transactional email handling, so the full order lifecycle can be tested and operated end to end.

## At A Glance

| Area | What It Covers |
| --- | --- |
| Storefront | Product browsing, filters, detail pages, and cart actions |
| Checkout | Guest and account checkout with secure Stripe card payment |
| Orders | Persistent order records, Stripe webhook confirmation, and email follow-up |
| Admin | Product management, Stripe visibility, and controlled test utilities |
| Stack | Next.js, React, TypeScript, Prisma, PostgreSQL, Stripe, Tailwind |

## Built With

Alp3D Shop uses Next.js 15 with the App Router, React 19, and TypeScript. Data is managed with Prisma and PostgreSQL. Payments are handled through Stripe Checkout and webhook events. Transactional emails are sent via SMTP or Resend, depending on your environment. Styling is implemented with Tailwind CSS, and deployment is prepared for Vercel.

## How The System Is Structured

The codebase is organized around clear responsibilities. `src/app` contains pages and API routes, `src/components` contains reusable UI building blocks, `src/lib` contains business logic and integration code, `prisma` contains schema and seed scripts, and `public` contains static assets, including the Alp3D Shop logo. In practice, this keeps the storefront, checkout, payments, and admin tooling separated without making the project hard to understand.

## Local Setup

To run Alp3D Shop locally, install dependencies with `npm install`, then create your local environment file by copying `.env.example` to `.env.local`.

After that, prepare the database with `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`. Once setup is complete, start the app with `npm run dev`.

The app will be available at `http://localhost:3000`.

## Payment And Email Flow

Checkout is available to signed-in customers and to anonymous guests: guests keep their cart in the browser (`src/lib/guest-cart.ts`) and provide shipping details directly at checkout, while signed-in customers can reuse saved addresses. Payment is accepted securely through Stripe Checkout by credit or debit card; there is no manual invoice option.

Checkout sessions are created server-side in `src/app/api/checkout/route.ts`. Payment completion is accepted only after Stripe webhook verification in `src/app/api/webhooks/payment/route.ts`, which cross-checks the paid amount, currency, and customer email before marking an order as paid. Stripe redirects the shopper to a dedicated `/success` or `/failed` page rather than back into the checkout form.

For environments that use both preview and production domains, Alp3D Shop now resolves Stripe redirect URLs from the active request host when possible. This reduces the risk of a working Stripe setup being misread as broken simply because `APP_URL` still points at an older Vercel or preview domain.

Email delivery is handled in `src/lib/mail.ts`. If SMTP credentials are present, SMTP is used. If not, Resend can be used through `RESEND_API_KEY`. In production, a missing mail configuration raises an error instead of silently dropping the message.

## Production Readiness

Alp3D Shop includes rate limiting, input validation, role checks for admin routes, and Stripe webhook signature verification. Recent hardening work also added stricter checkout email validation, stronger webhook checks for amount and payment status, safer upload file validation based on binary signatures, and better Stripe diagnostics when a webhook is registered on the correct endpoint path but a different domain.

For production rollout, secrets must stay in Vercel environment settings and never be committed to Git. Database migrations should be run intentionally, and deployment builds should not silently seed production data.

A practical release checklist is available in `PRODUCTION_CHECKLIST.md`.

## Scripts

The most relevant scripts are `npm run dev`, `npm run build`, `npm run start`, `npm run typecheck`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.

## Repository Documents

Project behavior and collaboration standards are documented in `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `CHANGELOG.md`.

## License

Alp3D Shop is released under the MIT License. See `LICENSE` for details.
