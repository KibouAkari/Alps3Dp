import nodemailer from "nodemailer";
import { Resend } from "resend";

import { getConfiguredAppBaseUrl } from "@/lib/app-url";
import { formatOrderNumber } from "@/lib/order-number";
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
      "Alps3Dp · Handgefertigte 3D-gedruckte Produkte aus der Schweiz",
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
    <div style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
      <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(params.preview)}</span>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
              <tr>
                <td align="center" bgcolor="${brand.accentColor}" style="padding:28px 24px 24px;background-color:${brand.accentColor};background-image:linear-gradient(135deg,${brand.primaryColor},${brand.accentColor});">
                  <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" width="76" height="76" style="display:block;margin:0 auto 10px;border-radius:50%;border:3px solid rgba(255,255,255,.85);background:#ffffff;" />
                  <div style="color:#ffffff;font-size:13px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;">${escapeHtml(brand.name)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:30px 28px 26px;">
                  <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0f172a;">${escapeHtml(params.title)}</h1>
                  <div style="font-size:15px;line-height:1.65;color:#334155;">${params.contentHtml}</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:18px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
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

function renderButton(
  url: string,
  label: string,
  brand: ReturnType<typeof getBrandConfig>,
) {
  return `<p style="margin:22px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${brand.accentColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:15px;">${escapeHtml(label)}</a></p>`;
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

  const shippingRow =
    typeof data.shippingCents === "number"
      ? summaryRow(
          "Versand",
          data.shippingCents === 0 ? "Gratis" : formatChf(data.shippingCents),
        )
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;font-size:14px;">${rows}<tr><td colspan="2" style="padding-top:8px;"></td></tr>${shippingRow}${summaryRow("Total", formatChf(data.totalCents), true)}</table>`;
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
  const safeName = escapeHtml(params.name || brand.name);
  await sendMail(
    params.to,
    `Willkommen bei ${brand.name} – bitte E-Mail bestätigen`,
    renderMailShell({
      title: `Willkommen, ${safeName}!`,
      preview:
        "Dein Konto wurde erstellt. Bitte bestätige noch kurz deine E-Mail-Adresse.",
      contentHtml: `<p style="margin:0 0 10px;">Schön, dass du da bist! Dein Konto ist bereit – bestätige nur noch kurz deine E-Mail-Adresse, damit du bestellen kannst.</p>${renderButton(params.verifyUrl, "E-Mail bestätigen", brand)}${renderLinkFallback(params.verifyUrl)}<p style="margin-top:22px;">Danach kannst du direkt unsere Produkte entdecken und den Status deiner Bestellungen verfolgen.</p>`,
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
      title: `Willkommen, ${safeName}!`,
      preview: "Dein Konto wurde erfolgreich erstellt.",
      contentHtml: `<p style="margin:0 0 10px;">Schön, dass du da bist.</p><p style="margin:0;">Dein Konto ist bereit und du kannst direkt Produkte entdecken, bestellen und den Status deiner Bestellungen verfolgen.</p>${renderButton(brand.appUrl, "Zum Shop", brand)}`,
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
  const owner = process.env.ADMIN_ORDER_EMAIL?.trim();
  const safeCustomerName = escapeHtml(params.customerName);
  const orderNumber = formatOrderNumber(params.orderNumber);
  const safeOrderNumber = escapeHtml(orderNumber);
  const paymentLabel = params.paymentMethod
    ? PAYMENT_LABELS[params.paymentMethod] || params.paymentMethod
    : null;
  const orderedAt = formatSwissDateTime(params.createdAt ?? new Date());
  const table = renderOrderTable(params);
  const address = renderAddressBlock(params);

  // Customer confirmation is business-critical, so its failure is propagated
  // to the caller; the owner notification below is best-effort only.
  await sendMail(
    params.customerEmail,
    `Bestellbestätigung ${orderNumber}`,
    renderMailShell({
      title: "Danke für deine Bestellung!",
      preview: `Deine Bestellung ${orderNumber} ist bei uns eingegangen.`,
      contentHtml: `<p style="margin:0 0 6px;">Hallo ${safeCustomerName}</p><p style="margin:0;">Vielen Dank für deine Bestellung <strong>${safeOrderNumber}</strong> vom ${escapeHtml(orderedAt)}. Wir bereiten sie nun für dich vor und melden uns, sobald sie unterwegs ist.</p>${table}${address}${paymentLabel ? `<p style="margin:0;color:#64748b;font-size:13px;">Zahlungsart: ${escapeHtml(paymentLabel)}</p>` : ""}${renderButton(`${brand.appUrl}/account`, "Bestellstatus ansehen", brand)}<p style="margin-top:22px;color:#64748b;font-size:13px;">Fragen? Antworte einfach auf diese E-Mail.</p>`,
    }),
    { replyTo: brand.supportEmail, idempotencyKey: `order-confirmation/${params.orderId}` },
  );

  if (owner) {
    try {
      await sendMail(
        owner,
        `Neue Bestellung ${orderNumber} – ${params.customerName} – ${formatChf(params.totalCents)}`,
        renderMailShell({
          title: `Neue Bestellung ${safeOrderNumber}`,
          preview: `${params.customerName} hat für ${formatChf(params.totalCents)} bestellt.`,
          contentHtml: `<p style="margin:0;"><strong>Bestellt am:</strong> ${escapeHtml(orderedAt)}<br /><strong>Kunde:</strong> ${safeCustomerName}<br /><strong>E-Mail:</strong> <a href="mailto:${escapeHtml(params.customerEmail)}" style="color:${brand.accentColor};">${escapeHtml(params.customerEmail)}</a>${paymentLabel ? `<br /><strong>Zahlungsart:</strong> ${escapeHtml(paymentLabel)}` : ""}</p>${table}${address}${renderButton(`${brand.appUrl}/admin`, "Im Admin öffnen", brand)}`,
        }),
        { replyTo: params.customerEmail, idempotencyKey: `order-owner/${params.orderId}` },
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
