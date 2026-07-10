# Security Policy

## Supported Versions

This repository currently supports only the latest version on the default branch.

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Report security concerns via private contact to the repository owner and include:

- A short description of the issue
- Reproduction steps
- Potential impact
- Suggested mitigation (if available)

You will receive an acknowledgment as soon as possible. We will validate, triage, and coordinate a fix before public disclosure.

## Secrets and Credentials

- Never commit `.env.local` or production credentials
- Use placeholder values in `.env.example`
- Store production secrets only in your deployment platform secret manager
- Rotate credentials immediately if accidental exposure is suspected
