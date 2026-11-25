# Security Policy for Alps3Dp

<p align="center"><img src="public/images/logo.jpeg" alt="Alps3Dp Logo" width="72"></p>

Security is a core requirement for Alps3Dp because the platform handles user accounts, order data, payment flows, and transactional communication.

If you discover a vulnerability, please report it privately to the repository maintainer and do not open a public issue. A helpful report includes a clear summary, reproduction steps, expected impact, and any mitigation ideas you already identified. We will acknowledge receipt, validate the report, and coordinate a responsible fix process.

The repository supports the latest state of the default branch. Security fixes are applied there first.

Account verification links, password-reset tokens and login security notifications are private to the affected account. Only operational order and contact enquiries are copied to the designated shop manager. Changes to mail routing must not copy credential-recovery or session links to staff inboxes. Resend delivery IDs are not proof of recipient inbox placement, and account or order data must not be recorded in plaintext server error logs.

Please treat all secrets as sensitive at all times. Files such as `.env.local` must never be committed. Use placeholders in `.env.example`, and keep production secrets only in your deployment platform secret manager. If any credential may have been exposed, rotate it immediately and treat the event as a security incident.

For production deployments of Alps3Dp, ensure that Stripe webhook secrets, database credentials, and authentication secrets are configured outside of source control. Use `PRODUCTION_CHECKLIST.md` as part of your release process.
