# Changelog

<p align="center"><img src="public/images/logo.png" alt="Alp3D Shop Logo" width="72"></p>

All notable changes to Alp3D Shop are documented in this file.

## 2026-07-10

This update focused on production readiness, documentation quality, and security hardening.

The project documentation was rewritten to be clearer for non-technical readers and to present the product in a more professional way. The README now explains the purpose of the website, the complete customer journey, and the technologies in use in a concise and human tone. Repository policy files were also rewritten to improve readability and consistency.

On the implementation side, checkout and payment handling were hardened. The checkout endpoint now enforces verified account email usage, webhook processing now verifies payment state and amount consistency before applying order state changes, and admin reset operations now require explicit confirmation and are rate-limited. File upload validation was strengthened with server-side signature checks for supported image types.

Deployment defaults were also adjusted to reduce operational risk. The Vercel build process no longer performs implicit database push/seed steps during standard production builds.
