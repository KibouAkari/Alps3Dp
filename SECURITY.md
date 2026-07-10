# Security Policy for Alp3D Shop

![Alp3D Shop Logo](public/images/logo.svg)

Security is a core requirement for Alp3D Shop because the platform handles user accounts, order data, payment flows, and transactional communication.

If you discover a vulnerability, please report it privately to the repository maintainer and do not open a public issue. A helpful report includes a clear summary, reproduction steps, expected impact, and any mitigation ideas you already identified. We will acknowledge receipt, validate the report, and coordinate a responsible fix process.

The repository supports the latest state of the default branch. Security fixes are applied there first.

Please treat all secrets as sensitive at all times. Files such as `.env.local` must never be committed. Use placeholders in `.env.example`, and keep production secrets only in your deployment platform secret manager. If any credential may have been exposed, rotate it immediately and treat the event as a security incident.

For production deployments of Alp3D Shop, ensure that Stripe webhook secrets, database credentials, and authentication secrets are configured outside of source control. Use `PRODUCTION_CHECKLIST.md` as part of your release process.
