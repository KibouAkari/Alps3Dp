import nodemailer from "nodemailer";
import { Resend } from "resend";

type MailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
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

async function sendMail(to: string, subject: string, html: string) {
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
  });
}

function renderMailShell(params: { title: string; preview: string; contentHtml: string }) {
  return `
    <div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:18px 24px;background:linear-gradient(120deg,#0ea5e9,#0369a1);color:#e0f2fe;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Alps3Dp</td>
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
                  Alps3Dp · Handgefertigte 3D-gedruckte Produkte aus der Schweiz
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function sendVerifyEmail(to: string, verifyUrl: string) {
  const safeUrl = escapeHtml(verifyUrl);
  await sendMail(
    to,
    "Bitte bestätige deine E-Mail",
    renderMailShell({
      title: "Bitte bestätige deine E-Mail",
      preview: "Bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.",
      contentHtml: `<p>Willkommen bei Alps3Dp.</p><p>Bitte bestätige deine E-Mail: <a href=\"${safeUrl}\" style=\"color:#0369a1;font-weight:600;\">E-Mail bestätigen</a></p>`,
    }),
  );
}

export async function sendWelcomeEmail(params: { to: string; name: string }) {
  const safeName = escapeHtml(params.name || "bei Alps3Dp");
  const appUrl = escapeHtml(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://alps3dp.ch");
  await sendMail(
    params.to,
    "Willkommen bei Alps3Dp",
    renderMailShell({
      title: `Willkommen, ${safeName}`,
      preview: "Dein Konto wurde erfolgreich erstellt.",
      contentHtml:
        `<p>Schön, dass du da bist.</p><p>Dein Konto ist bereit und du kannst direkt Produkte entdecken, bestellen und den Status deiner Bestellungen verfolgen.</p><p style=\"margin-top:18px;\"><a href=\"${appUrl}\" style=\"display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600;\">Zum Shop</a></p>`,
    }),
  );
}

export async function sendLoginSuccessEmail(to: string) {
  await sendMail(
    to,
    "Login erfolgreich",
    renderMailShell({
      title: "Login erfolgreich",
      preview: "Dein Konto wurde soeben erfolgreich angemeldet.",
      contentHtml: "<p>Dein Login war erfolgreich. Falls du das nicht warst, bitte Passwort sofort ändern.</p>",
    }),
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const safeUrl = escapeHtml(resetUrl);
  await sendMail(
    to,
    "Passwort zurücksetzen",
    renderMailShell({
      title: "Passwort zurücksetzen",
      preview: "Setze dein Passwort sicher zurück.",
      contentHtml: `<p>Klicke hier, um dein Passwort zurückzusetzen: <a href=\"${safeUrl}\" style=\"color:#0369a1;font-weight:600;\">Passwort zurücksetzen</a></p>`,
    }),
  );
}

export async function sendOrderEmails(params: {
  customerEmail: string;
  customerName: string;
  orderId: string;
  totalCents: number;
  lines: Array<{ title: string; quantity: number; unitCents: number }>;
}) {
  const owner = process.env.ADMIN_ORDER_EMAIL;
  const lineItemsHtml = params.lines
    .map(
      (line) =>
        `<li>${line.quantity}x ${escapeHtml(line.title)} - CHF ${(line.unitCents * line.quantity / 100).toFixed(2)}</li>`,
    )
    .join("");
  const safeCustomerName = escapeHtml(params.customerName);
  const safeOrderId = escapeHtml(params.orderId);

  await sendMail(
    params.customerEmail,
    "Bestellung erfolgreich",
    renderMailShell({
      title: "Bestellung erfolgreich",
      preview: "Deine Bestellung wurde erfolgreich erfasst.",
      contentHtml: `<p>Danke ${safeCustomerName}, deine Bestellung ${safeOrderId} war erfolgreich.</p><ul>${lineItemsHtml}</ul><p>Total: CHF ${(params.totalCents / 100).toFixed(2)}</p>`,
    }),
  );

  if (owner) {
    await sendMail(
      owner,
      `Neue Bestellung ${safeOrderId}`,
      renderMailShell({
        title: `Neue Bestellung ${safeOrderId}`,
        preview: "Neue Bestellung im Shop eingegangen.",
        contentHtml: `<p>Bitte Bestellung bearbeiten und versenden.</p><ul>${lineItemsHtml}</ul><p>Einnahmen: CHF ${(params.totalCents / 100).toFixed(2)}</p>`,
      }),
    );
  }
}
