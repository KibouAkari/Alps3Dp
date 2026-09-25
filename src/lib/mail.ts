import nodemailer from "nodemailer";
import { Resend } from "resend";

import { getConfiguredAppBaseUrl } from "@/lib/app-url";
import { formatOrderNumber } from "@/lib/order-number";

type MailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

type MailSender = {
  sendMail: (payload: MailPayload) => Promise<void>;
};

let cachedMailSender: MailSender | null | undefined;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

function getMailFrom() {
  return process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || "Alps3Dp <noreply@alps3dp.ch>";
}

// Central branding config so the mail look & feel (logo, colors, texts) can
// be changed via env vars alone, without touching template code.
function getBrandConfig() {
  const appUrl = getConfiguredAppBaseUrl().replace(/\/$/, "");
  return {
    name: process.env.MAIL_BRAND_NAME?.trim() || "Alps3Dp",
    appUrl,
    logoUrl: process.env.MAIL_LOGO_URL?.trim() || `${appUrl}/images/logo.jpeg`,
    primaryColor: process.env.MAIL_PRIMARY_COLOR?.trim() || "#0ea5e9",
    accentColor: process.env.MAIL_ACCENT_COLOR?.trim() || "#0369a1",
    supportEmail:
      process.env.MAIL_SUPPORT_EMAIL?.trim() ||
      process.env.ADMIN_ORDER_EMAIL?.trim() ||
      "support@alps3dp.ch",
    footerText:
      process.env.MAIL_FOOTER_TEXT?.trim() || "Alps3Dp · Handgefertigte 3D-gedruckte Produkte aus der Schweiz",
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function getMailSender() {
  if (cachedMailSender !== undefined) {
    return cachedMailSender;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (smtpHost && smtpUser && smtpPassword) {
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure = parseBoolean(process.env.SMTP_SECURE, smtpPort === 465);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    cachedMailSender = {
      sendMail: async (payload) => {
        await transporter.sendMail(payload);
      },
    };

    return cachedMailSender;
  }

  const resendClient = getResendClient();
  if (resendClient) {
    cachedMailSender = {
      sendMail: async (payload) => {
        await resendClient.emails.send(payload);
      },
    };

    return cachedMailSender;
  }

  cachedMailSender = null;
  return cachedMailSender;
}

async function sendMail(to: string, subject: string, html: string, options?: { replyTo?: string }) {
  const sender = getMailSender();
  if (!sender) {
    const message = "Mail-Versand ist nicht konfiguriert. RESEND_API_KEY oder SMTP-Zugangsdaten fehlen.";
    console.error("[mail:disabled]", { to, subject, message });
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    return;
  }

  await sender.sendMail({
    from: getMailFrom(),
    to,
    subject,
    html,
    replyTo: options?.replyTo,
  });
}

function renderMailShell(params: { title: string; preview: string; contentHtml: string }) {
  const brand = getBrandConfig();
  return `
    <div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:18px 24px;background:linear-gradient(120deg,${brand.primaryColor},${brand.accentColor});">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;padding-right:10px;">
                        <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" width="28" height="28" style="display:block;border-radius:50%;border:0;" />
                      </td>
                      <td style="vertical-align:middle;color:#e0f2fe;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">${escapeHtml(brand.name)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(params.preview)}</p>
                  <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#0f172a;">${escapeHtml(params.title)}</h1>
                  <div style="font-size:15px;line-height:1.6;color:#334155;">${params.contentHtml}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
                  ${escapeHtml(brand.footerText)}<br />
                  <a href="${escapeHtml(brand.appUrl)}" style="color:${brand.accentColor};text-decoration:none;">${escapeHtml(brand.appUrl.replace(/^https?:\/\//, ""))}</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${brand.accentColor};text-decoration:none;">${escapeHtml(brand.supportEmail)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function renderButton(url: string, label: string, brand: ReturnType<typeof getBrandConfig>) {
  return `<p style="margin-top:18px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${brand.accentColor};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export async function sendVerifyEmail(to: string, verifyUrl: string) {
  const brand = getBrandConfig();
  await sendMail(
    to,
    "Bitte bestätige deine E-Mail",
    renderMailShell({
      title: "Bitte bestätige deine E-Mail",
      preview: "Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.",
      contentHtml: `<p>Willkommen bei ${escapeHtml(brand.name)}.</p><p>Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.</p>${renderButton(verifyUrl, "E-Mail bestätigen", brand)}<p style="margin-top:18px;color:#64748b;font-size:13px;">Falls der Button nicht funktioniert, kopiere diesen Link: ${escapeHtml(verifyUrl)}</p>`,
    }),
  );
}

export async function sendWelcomeEmail(params: { to: string; name: string }) {
  const brand = getBrandConfig();
  const safeName = escapeHtml(params.name || brand.name);
  await sendMail(
    params.to,
    `Willkommen bei ${brand.name}`,
    renderMailShell({
      title: `Willkommen, ${safeName}`,
      preview: "Dein Konto wurde erfolgreich erstellt.",
      contentHtml:
        `<p>Schön, dass du da bist.</p><p>Dein Konto ist bereit und du kannst direkt Produkte entdecken, bestellen und den Status deiner Bestellungen verfolgen.</p>${renderButton(brand.appUrl, "Zum Shop", brand)}`,
    }),
  );
}

export async function sendLoginSuccessEmail(to: string) {
  const brand = getBrandConfig();
  await sendMail(
    to,
    "Login erfolgreich",
    renderMailShell({
      title: "Login erfolgreich",
      preview: "Dein Konto wurde soeben erfolgreich angemeldet.",
      contentHtml: `<p>Dein Login war erfolgreich. Falls du das nicht warst, ändere bitte sofort dein Passwort und kontaktiere uns unter <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${brand.accentColor};">${escapeHtml(brand.supportEmail)}</a>.</p>`,
    }),
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const brand = getBrandConfig();
  await sendMail(
    to,
    "Passwort zurücksetzen",
    renderMailShell({
      title: "Passwort zurücksetzen",
      preview: "Setze dein Passwort sicher zurück.",
      contentHtml: `<p>Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen.</p>${renderButton(resetUrl, "Passwort zurücksetzen", brand)}<p style="margin-top:18px;color:#64748b;font-size:13px;">Der Link ist 60 Minuten gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>`,
    }),
  );
}

export async function sendOrderEmails(params: {
  customerEmail: string;
  customerName: string;
  orderId: string;
  orderNumber: number;
  totalCents: number;
  lines: Array<{ title: string; quantity: number; unitCents: number }>;
}) {
  const brand = getBrandConfig();
  const owner = process.env.ADMIN_ORDER_EMAIL?.trim();
  const lineItemsHtml = params.lines
    .map(
      (line) =>
        `<li>${line.quantity}x ${escapeHtml(line.title)} - CHF ${(line.unitCents * line.quantity / 100).toFixed(2)}</li>`,
    )
    .join("");
  const safeCustomerName = escapeHtml(params.customerName);
  const safeOrderNumber = escapeHtml(formatOrderNumber(params.orderNumber));

  // Customer confirmation is business-critical, so its failure is propagated
  // to the caller; the owner notification below is best-effort only.
  await sendMail(
    params.customerEmail,
    `Bestellbestätigung ${safeOrderNumber}`,
    renderMailShell({
      title: "Danke für deine Bestellung",
      preview: "Deine Bestellung wurde erfolgreich erfasst.",
      contentHtml: `<p>Hallo ${safeCustomerName}, danke für deine Bestellung <strong>${safeOrderNumber}</strong>.</p><ul style="padding-left:18px;margin:12px 0;">${lineItemsHtml}</ul><p><strong>Total: CHF ${(params.totalCents / 100).toFixed(2)}</strong></p>${renderButton(`${brand.appUrl}/account`, "Bestellstatus ansehen", brand)}`,
    }),
  );

  if (owner) {
    try {
      await sendMail(
        owner,
        `Neue Bestellung ${safeOrderNumber}`,
        renderMailShell({
          title: `Neue Bestellung ${safeOrderNumber}`,
          preview: "Neue Bestellung im Shop eingegangen.",
          contentHtml: `<p>Von: ${safeCustomerName} (${escapeHtml(params.customerEmail)})</p><ul style="padding-left:18px;margin:12px 0;">${lineItemsHtml}</ul><p>Einnahmen: CHF ${(params.totalCents / 100).toFixed(2)}</p>`,
        }),
        { replyTo: params.customerEmail },
      );
    } catch (error) {
      console.error("[mail:order-owner-notification]", error);
    }
  }
}

export async function sendContactMessage(params: {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}) {
  const brand = getBrandConfig();
  const owner = brand.supportEmail;
  const safeName = escapeHtml(`${params.firstName} ${params.lastName}`.trim());
  const safeEmail = escapeHtml(params.email);
  const safeSubject = escapeHtml(params.subject);
  const safeMessage = escapeHtml(params.message).replaceAll("\n", "<br />");

  // Notify the owner (critical path, reply-to the customer directly).
  await sendMail(
    owner,
    `Kontaktformular: ${params.subject}`,
    renderMailShell({
      title: "Neue Kontaktanfrage",
      preview: `Neue Nachricht von ${safeName}`,
      contentHtml: `<p><strong>Von:</strong> ${safeName} (${safeEmail})</p><p><strong>Betreff:</strong> ${safeSubject}</p><p>${safeMessage}</p>`,
    }),
    { replyTo: params.email },
  );

  // Confirmation to the person who submitted the form; failure here should
  // not fail the whole request since the owner already received the message.
  try {
    await sendMail(
      params.email,
      "Wir haben deine Nachricht erhalten",
      renderMailShell({
        title: `Danke, ${safeName}`,
        preview: "Wir melden uns so schnell wie möglich bei dir.",
        contentHtml: `<p>Wir haben deine Nachricht zum Thema "${safeSubject}" erhalten und melden uns so schnell wie möglich.</p><p style="margin-top:14px;color:#64748b;font-size:13px;">Deine Nachricht:<br />${safeMessage}</p>`,
      }),
      { replyTo: owner },
    );
  } catch (error) {
    console.error("[mail:contact-confirmation]", error);
  }
}


