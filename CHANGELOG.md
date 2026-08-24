# Changelog

<p align="center"><img src="public/images/logo.jpeg" alt="Alp3D Shop Logo" width="72"></p>

All notable changes to Alp3D Shop are documented in this file.

## 2026-08-24

This pass focused on Stripe webhook correctness across production, preview, and custom-domain environments.

The project now resolves its public base URL more carefully. Request-driven flows such as Stripe Checkout redirects no longer rely only on `APP_URL` or `NEXT_PUBLIC_APP_URL`; they prefer the actual host serving the request. That prevents Stripe test and live sessions from redirecting shoppers back to a stale preview domain when the storefront is being accessed through the real production host.

The Stripe admin overview was also improved so webhook detection is no longer falsely reported as missing when Stripe is already configured for the same `/api/webhooks/payment` path on a different domain. The admin panel now distinguishes between an exact match and a domain mismatch, shows the registered URL it found, and makes it clearer when the remaining issue is environment configuration rather than a broken webhook endpoint.

## 2026-08-20

A follow-up pass fixed a real, live bug: the storefront home page could show a raw browser error ("Unexpected end of JSON input") instead of the product grid whenever an API response wasn't valid JSON. The root cause was a widespread pattern across nearly every client-side data fetch (storefront, cart, checkout, account, auth, admin) that assumed `response.json()` always succeeds. All of these now go through one shared, defensive JSON parser (`src/lib/fetch-json.ts`) instead of each screen duplicating its own try/catch, so a bad response shows a proper error message instead of crashing. `getAppBaseUrl()`'s production fallback was also corrected to the canonical `www.alps3dp.ch` host. Product image uploads no longer force an incorrect `image/webp` content type on JPEG/PNG/GIF files; the content type is now derived from the actual file extension.

Major navigation and admin design overhaul.

Replaced the old logo with the new circular Alps3Dp mark (`public/images/logo.jpeg`) across the site header, sidebar, and social/share metadata. Replaced the top navbar with a left-hand sidebar (`src/components/site-sidebar.tsx`): primary links now show icons, the cart badge lives inline, and the account area (login, account settings, logout, theme toggle) is anchored to the bottom of the sidebar instead of a top-right dropdown. On small screens the sidebar collapses into a slim top bar with a slide-in drawer. The main content area shifts right (`md:ml-64`) to make room for it on desktop.

Introduced a violet accent (matching the reference dashboard design) for the sidebar, admin dashboard stat cards, and the admin product form, layered on top of the existing light/dark theme system rather than replacing it site-wide.

The storefront product filters are now collapsible via a "Filter" button with a custom hamburger icon (longer middle bar), instead of always being visible.

Simplified the admin "new/edit product" form into three clearly numbered sections - Produktbilder, Basisdaten, and Preis/Lager/Sichtbarkeit - so editing a product doesn't require scanning one long unlabeled grid of fields. The admin dashboard's stat cards gained a staggered fade-in and hover-lift animation.

## 2026-08-16

**Temporary:** the checkout's "please verify your email" requirement for signed-in customers is commented out in `src/app/api/checkout/route.ts` until mail delivery is configured, so checkout can be tested end to end without SMTP/Resend set up. Re-enable it once email is live.

Fixed two admin bugs that both stemmed from the same root cause: API routes throwing unhandled errors and returning a non-JSON response, which the admin UI then failed to parse ("Unexpected end of JSON input"). Deleting a product that had ever been ordered failed outright, because orders keep a database reference to their products; deletion now catches that case and returns a clear message asking to hide the product instead. Uploading images (including drag-and-drop) could hit the same class of failure if image storage wasn't configured. Both API routes now always return JSON, and the admin product screen parses responses defensively and shows a real error message instead of crashing. Deleting a product now also asks for confirmation first.

Reworked product deletion and visibility based on follow-up feedback. Deleting a product now always removes it from every list (storefront and admin), regardless of order history: if it was never ordered it's hard-deleted, otherwise it's soft-deleted (a new `Product.deletedAt` column) so past orders keep a valid reference in the background. The "hide" button no longer just pre-fills the edit form and waits for a manual save - clicking it now immediately toggles visibility, while the product still stays in the admin list (shown as "Versteckt") so it can be restored or edited later. All storefront and admin product queries now consistently exclude soft-deleted rows.

**Action required for production:** this adds a new nullable `deletedAt` column to the `Product` table. Apply it to the production database before relying on delete/hide in production (for example `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);`, or `prisma db push` if you've confirmed there's no unrelated schema drift to review first).

This update focused on checkout completeness, code clarity, and removing dead code.

Checkout now supports guest orders end to end: anonymous shoppers get a browser-side cart, can check out with any email address, and are no longer required to match a signed-in account's email. The invoice/manual payment option was removed in favor of Stripe card and TWINT only, and Stripe now redirects shoppers to dedicated, animated `/success` and `/failed` pages instead of back into the checkout form. Stripe configuration errors (for example, a publishable key pasted into the secret key field) are now detected and reported with an actionable message. Password resets now invalidate all existing sessions for the account, and transactional mail delivery fails loudly in production instead of silently no-op'ing when no provider is configured.

The codebase also received a documentation pass: business-critical modules (payments, checkout, the Stripe webhook, auth, sessions, rate limiting) gained explanatory comments, and confirmed-unused legacy code was removed, including the early demo-data placeholders in `src/lib/data.ts`, an unused integration-roadmap file, and dead helper functions in the client session hook's supporting module.

A follow-up pass the same day fixed a real bug and closed a security gap. Drag-and-drop image uploads in the admin product form could silently reject valid images: the browser-side filter only trusted `File.type`, which some Windows/browser combinations leave empty for dropped (as opposed to picked) files, so it now also falls back to checking the file extension. The cart page could briefly show a signed-in user's stale local guest-cart items if their server-side cart was empty, because it inferred guest status from an ambiguous empty-list response; it now checks the real session state first, matching how checkout already behaved. The account password- and email-change endpoints had no rate limiting despite verifying the current password, so both now enforce per-account limits, and changing the password now signs out every other active session. The storefront home page now uses time-based revalidation instead of querying the database on every request.

## 2026-07-10

This update focused on production readiness, documentation quality, and security hardening.

The project documentation was rewritten to be clearer for non-technical readers and to present the product in a more professional way. The README now explains the purpose of the website, the complete customer journey, and the technologies in use in a concise and human tone. Repository policy files were also rewritten to improve readability and consistency.

On the implementation side, checkout and payment handling were hardened. The checkout endpoint now enforces verified account email usage, webhook processing now verifies payment state and amount consistency before applying order state changes, and admin reset operations now require explicit confirmation and are rate-limited. File upload validation was strengthened with server-side signature checks for supported image types.

Deployment defaults were also adjusted to reduce operational risk. The Vercel build process no longer performs implicit database push/seed steps during standard production builds.
