import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { Resend } from "resend";

import { getConfiguredAppBaseUrl } from "@/lib/app-url";
import { formatOrderNumber } from "@/lib/order-number";
import { getShopOperatorRecipients } from "@/lib/mail-recipients";
import { assertResendAccepted, htmlToPlainText, selectMailProvider } from "@/lib/mail-delivery";

type MailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
};

type MailSender = {
  provider: "resend" | "smtp";
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
  const configured = process.env.MAIL_FROM?.trim();
  if (configured) return configured;

  // Use a human-replyable default for the intended verified domain.
  // MAIL_FROM must be set explicitly when using any other verified domain.
  const provider = selectMailProvider({
    choice: process.env.MAIL_PROVIDER,
    resendKey: process.env.RESEND_API_KEY,
    smtpReady: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  });
  if (provider === "smtp" && process.env.SMTP_USER?.trim()) {
    return `Alps3Dp <${process.env.SMTP_USER.trim()}>`;
  }
  return "Alps3Dp <order@alps3dp.ch>";
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
      process.env.MAIL_FOOTER_TEXT?.trim() ||
      "Alps3Dp · Schweiz",
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function getMailSender(): MailSender | null {
  if (cachedMailSender !== undefined) return cachedMailSender;

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD;
  const provider = selectMailProvider({
    choice: process.env.MAIL_PROVIDER,
    resendKey: process.env.RESEND_API_KEY,
    smtpReady: Boolean(smtpHost && smtpUser && smtpPassword),
  });

  // Resend wins when its key exists. Never silently fall back to SMTP on a
  // Resend rejection: that would bypass the intended verified sending domain.
  if (provider === "resend") {
    const resendClient = getResendClient();
    if (!resendClient) throw new Error("Resend provider selected but RESEND_API_KEY is missing");
    cachedMailSender = {
      provider,
      sendMail: async (payload) => {
        const { idempotencyKey, ...message } = payload;
        const result = await resendClient.emails.send(
          message,
          idempotencyKey ? { idempotencyKey } : undefined,
        );
        assertResendAccepted(result);
      },
    };
    return cachedMailSender;
  }

  if (provider === "smtp" && smtpHost && smtpUser && smtpPassword) {
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure = parseBoolean(process.env.SMTP_SECURE, smtpPort === 465);
    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPassword },
    });
    cachedMailSender = {
      provider,
      sendMail: async ({ idempotencyKey: _idempotencyKey, ...payload }) => {
        // SMTP has no provider-level deduplication; ignored key is intentional.
        await transporter.sendMail(payload);
      },
    };
    return cachedMailSender;
  }

  cachedMailSender = null;
  return cachedMailSender;
}

async function sendMail(
  to: string,
  subject: string,
  html: string,
  options?: { replyTo?: string; idempotencyKey?: string },
) {
  const sender = getMailSender();
  if (!sender) {
    // Do not silently claim a successful send in development or production.
    throw new Error("E-Mail-Versand nicht konfiguriert: RESEND_API_KEY oder SMTP-Zugangsdaten fehlen.");
  }

  try {
    await sender.sendMail({
      from: getMailFrom(),
      to,
      subject,
      html,
      text: htmlToPlainText(html),
      replyTo: options?.replyTo,
      idempotencyKey: options?.idempotencyKey,
    });
  } catch (error) {
    // Never log raw provider exceptions: they may contain recipient addresses,
    // request bodies, verification links, or credentials.
    const detail = error instanceof Error && error.message.startsWith("Resend:")
      ? error.message : "Transport request failed";
    console.error("[mail:delivery]", { provider: sender.provider, reason: detail });
    throw new Error(`E-Mail konnte nicht versendet werden (${sender.provider}).`);
  }
}

function renderMailShell(params: {
  title: string;
  preview: string;
  contentHtml: string;
}) {
  const brand = getBrandConfig();
  return `
    <div style="margin:0;padding:0;background:#f7f9fb;color:#1f2937;font-family:Arial,Helvetica,sans-serif;">
      <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(params.preview)}</span>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background:#f7f9fb;">
        <tr><td align="center" style="padding:24px 12px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-collapse:separate;border-spacing:0;border-radius:10px;">
            <tr><td style="padding:22px 28px 18px;border-bottom:1px solid #e5e7eb;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)} Logo" width="48" height="48" style="display:block;width:48px;height:48px;border:0;border-radius:6px;" />
                  </td>
                  <td valign="middle" style="font-size:20px;line-height:26px;font-weight:700;color:#1f2937;">${escapeHtml(brand.name)}</td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:26px 28px 28px;">
              <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;font-weight:700;color:#111827;">${escapeHtml(params.title)}</h1>
              <div style="font-size:15px;line-height:1.65;color:#374151;">${params.contentHtml}</div>
            </td></tr>
            <tr><td style="padding:18px 28px;border-top:1px solid #e5e7eb;background:#fafbfc;color:#6b7280;font-size:12px;line-height:1.7;">
              ${escapeHtml(brand.footerText)}<br />
              <a href="${escapeHtml(brand.appUrl)}" style="color:${brand.accentColor};text-decoration:underline;">${escapeHtml(brand.appUrl.replace(/^https?:\/\//, ""))}</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${brand.accentColor};text-decoration:underline;">${escapeHtml(brand.supportEmail)}</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>
  `;
}

function renderButton(
  url: string,
  label: string,
  brand: ReturnType<typeof getBrandConfig>,
) {
  return `<p style="margin:22px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${brand.accentColor};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;font-size:15px;">${escapeHtml(label)}</a></p>`;
}

function renderLinkFallback(url: string) {
  return `<p style="margin-top:18px;color:#64748b;font-size:12px;word-break:break-all;">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br />${escapeHtml(url)}</p>`;
}

function formatChf(cents: number) {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

const PAYMENT_LABELS: Record<string, string> = {
  CARD: "Kreditkarte",
  TWINT: "TWINT",
  INVOICE: "Rechnung",
};

export type OrderMailData = {
  customerEmail: string;
  customerName: string;
  orderId: string;
  orderNumber: number;
  totalCents: number;
  subtotalCents?: number;
  shippingCents?: number;
  paymentMethod?: string;
  createdAt?: Date;
  shipping?: {
    address1: string;
    address2?: string | null;
    zip: string;
    city: string;
    country: string;
  };
  lines: Array<{ title: string; quantity: number; unitCents: number }>;
};

function renderOrderTable(data: OrderMailData) {
  const rows = data.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">${escapeHtml(line.title)}<br /><span style="color:#64748b;font-size:12px;">${line.quantity} × ${formatChf(line.unitCents)}</span></td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${formatChf(line.unitCents * line.quantity)}</td>
        </tr>`,
    )
    .join("");

  const summaryRow = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;${bold ? "font-weight:700;font-size:16px;color:#0f172a;" : "color:#64748b;"}">${label}</td><td align="right" style="padding:6px 0;white-space:nowrap;${bold ? "font-weight:700;font-size:16px;color:#0f172a;" : ""}">${value}</td></tr>`;

  const subtotalRow =
    typeof data.subtotalCents === "number"
      ? summaryRow("Zwischensumme", formatChf(data.subtotalCents))
      : "";
  const shippingRow =
    typeof data.shippingCents === "number"
      ? summaryRow(
          "Versand",
          data.shippingCents === 0 ? "Gratis" : formatChf(data.shippingCents),
        )
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;font-size:14px;">${rows}<tr><td colspan="2" style="padding-top:8px;"></td></tr>${subtotalRow}${shippingRow}${summaryRow("Total", formatChf(data.totalCents), true)}</table>`;
}

function renderAddressBlock(data: OrderMailData) {
  if (!data.shipping) {
    return "";
  }
  const s = data.shipping;
  const lines = [
    data.customerName,
    s.address1,
    s.address2,
    `${s.zip} ${s.city}`,
    s.country,
  ]
    .filter(Boolean)
    .map((line) => escapeHtml(String(line)))
    .join("<br />");
  return `<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;line-height:1.6;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px;">Lieferadresse</div>${lines}</div>`;
}

function formatSwissDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  }).format(date);
}

export async function sendVerifyEmail(to: string, verifyUrl: string) {
  const brand = getBrandConfig();
  await sendMail(
    to,
    "Bitte bestätige deine E-Mail",
    renderMailShell({
      title: "Bitte bestätige deine E-Mail",
      preview: "Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.",
      contentHtml: `<p style="margin:0 0 10px;">Bitte bestätige deine E-Mail-Adresse, um dein Konto bei ${escapeHtml(brand.name)} zu aktivieren.</p>${renderButton(verifyUrl, "E-Mail bestätigen", brand)}${renderLinkFallback(verifyUrl)}`,
    }),
  );
}

// Sent right after registration: welcome + verification in a single mail so
// new customers do not get two nearly identical messages at once.
export async function sendWelcomeVerifyEmail(params: {
  to: string;
  name: string;
  verifyUrl: string;
}) {
  const brand = getBrandConfig();

  await sendMail(
    params.to,
    `Willkommen bei ${brand.name} – bitte E-Mail bestätigen`,
    renderMailShell({
      title: `Willkommen, ${params.name || brand.name}!`,
      preview:
        "Dein Konto wurde erstellt. Bitte bestätige noch kurz deine E-Mail-Adresse.",
      contentHtml: `<p style="margin:0 0 10px;">Schön, dass du da bist! Dein Kundenkonto wurde erstellt. Bitte bestätige deine E-Mail-Adresse.</p>${renderButton(params.verifyUrl, "E-Mail bestätigen", brand)}${renderLinkFallback(params.verifyUrl)}<p style="margin-top:22px;">Danach kannst du Bestellungen und Lieferadressen in deinem Konto verwalten.</p>`,
    }),
  );
}

export async function sendWelcomeEmail(params: { to: string; name: string }) {
  const brand = getBrandConfig();

  await sendMail(
    params.to,
    `Willkommen bei ${brand.name}`,
    renderMailShell({
      title: `Willkommen, ${params.name || brand.name}!`,
      preview: "Dein Konto wurde erfolgreich erstellt.",
      contentHtml: `<p style="margin:0 0 10px;">Dein Kundenkonto wurde erstellt.</p><p style="margin:0;">Du kannst deine Bestellungen und Lieferadressen im Konto verwalten.</p>${renderButton(brand.appUrl, "Zum Shop", brand)}`,
    }),
  );
}

export async function sendLoginSuccessEmail(to: string) {
  const brand = getBrandConfig();
  await sendMail(
    to,
    "Neue Anmeldung bei deinem Konto",
    renderMailShell({
      title: "Anmeldung erfolgreich",
      preview: "Dein Konto wurde soeben angemeldet.",
      contentHtml: `<p style="margin:0;">Dein Konto wurde soeben angemeldet. Falls du das nicht warst, ändere bitte sofort dein Passwort und kontaktiere uns unter <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${brand.accentColor};">${escapeHtml(brand.supportEmail)}</a>.</p>`,
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
      contentHtml: `<p style="margin:0 0 10px;">Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen.</p>${renderButton(resetUrl, "Neues Passwort festlegen", brand)}${renderLinkFallback(resetUrl)}<p style="margin-top:18px;color:#64748b;font-size:13px;">Der Link ist 60 Minuten gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>`,
    }),
  );
}

type OrderWithItems = {
  id: string;
  orderNumber: number;
  customerEmail: string;
  customerName: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  paymentMethod: string;
  createdAt: Date;
  shippingAddress1: string;
  shippingAddress2: string | null;
  shippingZip: string;
  shippingCity: string;
  shippingCountry: string;
  items: Array<{
    quantity: number;
    unitCents: number;
    product: { title: string };
  }>;
};

// Single entry point so every code path (webhook, reconcile, admin test)
// sends identical, complete order mails.
export async function sendOrderEmailsForOrder(order: OrderWithItems) {
  await sendOrderEmails({
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    shipping: {
      address1: order.shippingAddress1,
      address2: order.shippingAddress2,
      zip: order.shippingZip,
      city: order.shippingCity,
      country: order.shippingCountry,
    },
    lines: order.items.map((item) => ({
      title: item.product.title,
      quantity: item.quantity,
      unitCents: item.unitCents,
    })),
  });
}

export async function sendOrderEmails(params: OrderMailData) {
  const brand = getBrandConfig();
  const operatorRecipients = getShopOperatorRecipients([process.env.ADMIN_ORDER_EMAIL]);
  const safeCustomerName = escapeHtml(params.customerName);
  const orderNumber = formatOrderNumber(params.orderNumber);
  const safeOrderNumber = escapeHtml(orderNumber);
  const paymentLabel = params.paymentMethod
    ? PAYMENT_LABELS[params.paymentMethod] || params.paymentMethod
    : null;
  const orderedAt = formatSwissDateTime(params.createdAt ?? new Date());
  const table = renderOrderTable(params);
  const address = renderAddressBlock(params);

  // Customer and operator sends are independent. An outage for one
  // recipient must not prevent attempting the other notification.
  let customerFailed = false;
  let operatorFailed = false;
  try {
    await sendMail(
      params.customerEmail,
      `Bestellbestätigung ${orderNumber}`,
      renderMailShell({
        title: "Bestellbestätigung",
        preview: `Deine Bestellung ${orderNumber} ist bei uns eingegangen.`,
        contentHtml: `<p style="margin:0 0 6px;">Hallo ${safeCustomerName}</p><p style="margin:0;">Wir haben deine Bestellung <strong>${safeOrderNumber}</strong> vom ${escapeHtml(orderedAt)} erhalten.</p>${table}${address}${paymentLabel ? `<p style="margin:0;color:#64748b;font-size:13px;">Zahlungsart: ${escapeHtml(paymentLabel)}</p>` : ""}${renderButton(`${brand.appUrl}/account`, "Bestellung ansehen", brand)}<p style="margin-top:22px;color:#64748b;font-size:13px;">Bei Fragen kannst du auf diese E-Mail antworten.</p>`,
      }),
      { replyTo: brand.supportEmail, idempotencyKey: `order-confirmation/${params.orderId}` },
    );
  } catch {
    console.error("[mail:order-customer-notification] Provider rejected customer confirmation");
    customerFailed = true;
  }

  // Every new order is sent to the shop manager, even when a different
  // administrative mailbox is configured. Attempt each recipient independently.
  for (const recipient of operatorRecipients) {
    try {
      await sendMail(
        recipient,
        `Neue Bestellung ${orderNumber}`,
        renderMailShell({
          title: `Neue Bestellung ${safeOrderNumber}`,
          preview: `Neue Bestellung ${orderNumber} im Shop.`,
          contentHtml: `<p style="margin:0 0 6px;"><strong>Bestellt am:</strong> ${escapeHtml(orderedAt)}<br /><strong>Kunde:</strong> ${safeCustomerName}<br /><strong>E-Mail:</strong> <a href="mailto:${escapeHtml(params.customerEmail)}" style="color:${brand.accentColor};">${escapeHtml(params.customerEmail)}</a>${paymentLabel ? `<br /><strong>Zahlungsart:</strong> ${escapeHtml(paymentLabel)}` : ""}</p>${table}${address}${renderButton(`${brand.appUrl}/admin`, "Bestellung verwalten", brand)}`,
        }),
        {
          replyTo: params.customerEmail,
          // Different recipients need different deduplication keys. Hash
          // sensitive values before exposing metadata to the provider.
          idempotencyKey: `order-operator/${createHash("sha256").update(params.orderId + "\0" + recipient.toLowerCase()).digest("hex")}`,
        },
      );
    } catch {
      console.error("[mail:order-operator] Provider rejected operator notification");
      operatorFailed = true;
    }
  }
  if (customerFailed || operatorFailed) {
    throw new Error("One or more order notifications were not accepted by the mail provider");
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
  const safeName = escapeHtml(`${params.firstName} ${params.lastName}`.trim());
  const safeEmail = escapeHtml(params.email);
  const safeSubject = escapeHtml(params.subject);
  const safeMessage = escapeHtml(params.message).replaceAll("\n", "<br />");

  // Send the customer's enquiry to the manager and any distinct support inbox.
  // These are separate sends so the manager still receives an attempt if
  // support's mailbox is temporarily unavailable.
  let operatorFailed = false;
  for (const recipient of getShopOperatorRecipients([brand.supportEmail])) {
    try {
      await sendMail(
        recipient,
        "Neue Kontaktanfrage",
        renderMailShell({
          title: "Neue Kontaktanfrage",
          preview: `Kontaktanfrage von ${params.firstName} ${params.lastName}`,
          contentHtml: `<p style="margin:0 0 8px;"><strong>Absender:</strong> ${safeName}<br /><strong>E-Mail:</strong> <a href="mailto:${safeEmail}" style="color:${brand.accentColor};">${safeEmail}</a><br /><strong>Betreff:</strong> ${safeSubject}</p><p style="margin:14px 0 0;"><strong>Nachricht</strong></p><p style="margin:6px 0 0;">${safeMessage}</p>`,
        }),
        { replyTo: params.email },
      );
    } catch {
      console.error("[mail:contact-operator] Provider rejected operator notification");
      operatorFailed = true;
    }
  }

  // Confirmation to the person who submitted the form; failure here should
  // not fail the whole request since the owner already received the message.
  try {
    await sendMail(
      params.email,
      "Wir haben deine Nachricht erhalten",
      renderMailShell({
        title: `Danke, ${params.firstName} ${params.lastName}`, 
        preview: "Wir melden uns so schnell wie möglich bei dir.",
        contentHtml: `<p>Wir haben deine Nachricht zum Thema "${safeSubject}" erhalten und melden uns so schnell wie möglich.</p><p style="margin-top:14px;color:#64748b;font-size:13px;">Deine Nachricht:<br />${safeMessage}</p>`,
      }),
      { replyTo: brand.supportEmail },
    );
  } catch {
    console.error("[mail:contact-confirmation] Provider rejected customer acknowledgement");
  }
  if (operatorFailed) {
    // Partial success is recorded. No durable retry queue exists yet.
    throw new Error("One or more contact operator notifications were not accepted");
  }
}
