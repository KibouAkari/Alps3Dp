# Changelog

<p align="center"><img src="public/images/logo.png" alt="Alp3D Shop Logo" width="72"></p>

All notable changes to Alp3D Shop are documented in this file.

## 2026-08-16

**Temporary:** the checkout's "please verify your email" requirement for signed-in customers is commented out in `src/app/api/checkout/route.ts` until mail delivery is configured, so checkout can be tested end to end without SMTP/Resend set up. Re-enable it once email is live.

Fixed two admin bugs that both stemmed from the same root cause: API routes throwing unhandled errors and returning a non-JSON response, which the admin UI then failed to parse ("Unexpected end of JSON input"). Deleting a product that had ever been ordered failed outright, because orders keep a database reference to their products; deletion now catches that case and returns a clear message asking to hide the product instead. Uploading images (including drag-and-drop) could hit the same class of failure if image storage wasn't configured. Both API routes now always return JSON, and the admin product screen parses responses defensively and shows a real error message instead of crashing. Deleting a product now also asks for confirmation first.

This update focused on checkout completeness, code clarity, and removing dead code.

Checkout now supports guest orders end to end: anonymous shoppers get a browser-side cart, can check out with any email address, and are no longer required to match a signed-in account's email. The invoice/manual payment option was removed in favor of Stripe card and TWINT only, and Stripe now redirects shoppers to dedicated, animated `/success` and `/failed` pages instead of back into the checkout form. Stripe configuration errors (for example, a publishable key pasted into the secret key field) are now detected and reported with an actionable message. Password resets now invalidate all existing sessions for the account, and transactional mail delivery fails loudly in production instead of silently no-op'ing when no provider is configured.

The codebase also received a documentation pass: business-critical modules (payments, checkout, the Stripe webhook, auth, sessions, rate limiting) gained explanatory comments, and confirmed-unused legacy code was removed, including the early demo-data placeholders in `src/lib/data.ts`, an unused integration-roadmap file, and dead helper functions in the client session hook's supporting module.

A follow-up pass the same day fixed a real bug and closed a security gap. Drag-and-drop image uploads in the admin product form could silently reject valid images: the browser-side filter only trusted `File.type`, which some Windows/browser combinations leave empty for dropped (as opposed to picked) files, so it now also falls back to checking the file extension. The cart page could briefly show a signed-in user's stale local guest-cart items if their server-side cart was empty, because it inferred guest status from an ambiguous empty-list response; it now checks the real session state first, matching how checkout already behaved. The account password- and email-change endpoints had no rate limiting despite verifying the current password, so both now enforce per-account limits, and changing the password now signs out every other active session. The storefront home page now uses time-based revalidation instead of querying the database on every request.

## 2026-07-10

This update focused on production readiness, documentation quality, and security hardening.

The project documentation was rewritten to be clearer for non-technical readers and to present the product in a more professional way. The README now explains the purpose of the website, the complete customer journey, and the technologies in use in a concise and human tone. Repository policy files were also rewritten to improve readability and consistency.

On the implementation side, checkout and payment handling were hardened. The checkout endpoint now enforces verified account email usage, webhook processing now verifies payment state and amount consistency before applying order state changes, and admin reset operations now require explicit confirmation and are rate-limited. File upload validation was strengthened with server-side signature checks for supported image types.

Deployment defaults were also adjusted to reduce operational risk. The Vercel build process no longer performs implicit database push/seed steps during standard production builds.
