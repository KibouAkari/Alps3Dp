# Mail Setup Guide

This shop sends real transactional e-mails for: contact form (owner + confirmation to
sender), order confirmation (customer + owner), first login / welcome, e-mail
verification, login notification and password reset. Everything is driven by
environment variables — no code changes are needed for a new deployment.

All mail logic lives in [src/lib/mail.ts](../src/lib/mail.ts). All variables below
go into your `.env` (local) or your hosting provider's environment settings
(e.g. Vercel → Project → Settings → Environment Variables).

## 1. Choose a provider (5 minutes)

You only need **one** of the two. Resend is recommended — it's simpler to set up.

### Option A — Resend (recommended)

1. Create a free account at https://resend.com.
2. Add and verify your sending domain (Resend → Domains → Add Domain), then add
   the shown SPF, DKIM and DMARC DNS records at your domain registrar.
   Verification usually completes within a few minutes up to a few hours.
3. Create an API key (Resend → API Keys) with "Sending access".
4. Set:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Option B — SMTP (e.g. your own mailbox, SES, Postmark, Mailgun, etc.)

Only used if `RESEND_API_KEY` is empty.

```
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
```

## 2. Set the sender & support addresses

```
MAIL_FROM=Alps3Dp <noreply@alps3dp.ch>
ADMIN_ORDER_EMAIL=orders@alps3dp.ch
MAIL_SUPPORT_EMAIL=support@alps3dp.ch
```

- `MAIL_FROM` must use a domain you verified in step 1 (Resend rejects unverified
  domains; most SMTP providers require the same or will land in spam otherwise).
- `ADMIN_ORDER_EMAIL` receives new-order and contact-form notifications.
- `MAIL_SUPPORT_EMAIL` is shown in every e-mail footer and used as the contact
  form's owner inbox if `ADMIN_ORDER_EMAIL` is not set. Customer replies to the
  contact-form owner notification are set up with `Reply-To` so support can just
  hit "reply" in their inbox.

## 3. Branding — logo, colors, texts

These variables control the look of every e-mail without touching any template code:

| Variable | Default | Purpose |
|---|---|---|
| `MAIL_BRAND_NAME` | `Alps3Dp` | Shown in the header and subject lines |
| `MAIL_LOGO_URL` | `${NEXT_PUBLIC_APP_URL}/images/logo.jpeg` | Must be a **public, absolute** URL — e-mail clients fetch it over the internet, they cannot see local files |
| `MAIL_PRIMARY_COLOR` | `#0ea5e9` | Header gradient start (matches the site's sky-blue theme) |
| `MAIL_ACCENT_COLOR` | `#0369a1` | Header gradient end, buttons, links |
| `MAIL_FOOTER_TEXT` | `Alps3Dp · Handgefertigte 3D-gedruckte Produkte aus der Schweiz` | Footer tagline |

Leave them empty to use the defaults, which already match the site's design.
Change `MAIL_LOGO_URL` only if you want a different image than the site logo
(e.g. a version with a white background, since some mail clients render on white).

## 4. Application URL (used for links & the logo)

```
NEXT_PUBLIC_APP_URL=https://www.alps3dp.ch
APP_URL=https://www.alps3dp.ch
```

Set these to your real production domain — they're used to build the logo URL and
all links/buttons inside e-mails (shop link, "view order" button, verify/reset links).

## 5. Full variable reference

Copy from [.env.example](../.env.example) and fill in every value marked below.

```
RESEND_API_KEY=            # Option A
MAIL_FROM=                 # required
ADMIN_ORDER_EMAIL=         # required (order + contact notifications)
MAIL_SUPPORT_EMAIL=        # optional, defaults to ADMIN_ORDER_EMAIL

SMTP_HOST=                 # Option B (only if no RESEND_API_KEY)
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASSWORD=

MAIL_BRAND_NAME=Alps3Dp
MAIL_LOGO_URL=
MAIL_PRIMARY_COLOR=#0ea5e9
MAIL_ACCENT_COLOR=#0369a1
MAIL_FOOTER_TEXT=
```

## 6. Test it

1. Fill in the variables above and restart the dev server (`npm run dev`) or
   redeploy.
2. Go to `/contact` and send yourself a test message — check that **both** the
   owner inbox (`ADMIN_ORDER_EMAIL`) and the sender's own address receive an
   e-mail.
3. Register a new account at `/auth/register` — check the welcome + verify e-mail.
4. Use "Passwort vergessen" on `/auth/login` — check the reset e-mail.
5. As an admin, open `/admin` → Ops tools → "Testbestellung erstellen" to trigger
   the full order-confirmation + owner-notification flow without a real payment.
6. Log out and log back in on the same account — you should get a "Login
   erfolgreich" e-mail (only the **first** login after registration sends the
   welcome e-mail; every login after that sends a short security notice).

## 7. Reliability & security notes (already implemented)

- If no provider is configured, mail sending is skipped with a logged warning in
  development, but **throws in production** so misconfiguration is caught early
  instead of silently losing e-mails.
- Order-confirmation e-mails are sent from the Stripe webhook. A failure to
  notify the *owner* (or a transient provider hiccup after the customer e-mail
  already went out) never fails the webhook response, so Stripe won't endlessly
  retry an already-paid order.
- The "forgot password" endpoint always returns success regardless of whether
  the account exists or the e-mail could be sent, to avoid leaking which
  addresses have an account (user enumeration).
- All user-supplied content (name, message, subject) is HTML-escaped before
  being inserted into e-mail templates to prevent HTML/script injection.
- Contact-form and password-reset endpoints are rate-limited per IP (and per
  e-mail for password reset) to prevent abuse/spam.

## 8. Going further

- For higher deliverability, keep using a verified custom domain (not a free
  Gmail/Outlook address) as `MAIL_FROM`.
- Monitor bounce/complaint rates in your provider's dashboard (Resend has this
  built in).
- Rotate `RESEND_API_KEY` / SMTP credentials if you ever suspect they leaked.
