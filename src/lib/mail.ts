import { Resend } from "resend";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

function getMailFrom() {
  return process.env.MAIL_FROM || "shop@localhost";
}

async function sendMail(to: string, subject: string, html: string) {
  const client = getResendClient();
  if (!client) {
    console.log("[mail:disabled]", { to, subject });
    return;
  }

  await client.emails.send({
    from: getMailFrom(),
    to,
    subject,
    html,
  });
}

export async function sendVerifyEmail(to: string, verifyUrl: string) {
  const safeUrl = escapeHtml(verifyUrl);
  await sendMail(
    to,
    "Bitte bestätige deine E-Mail",
    `<p>Willkommen bei Alps3Dp.</p><p>Bitte bestätige deine E-Mail: <a href=\"${safeUrl}\">E-Mail bestätigen</a></p>`,
  );
}

export async function sendLoginSuccessEmail(to: string) {
  await sendMail(
    to,
    "Login erfolgreich",
    "<p>Dein Login war erfolgreich. Falls du das nicht warst, bitte Passwort sofort aendern.</p>",
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const safeUrl = escapeHtml(resetUrl);
  await sendMail(
    to,
    "Passwort zurücksetzen",
    `<p>Klicke hier, um dein Passwort zurückzusetzen: <a href=\"${safeUrl}\">Passwort zurücksetzen</a></p>`,
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
    `<p>Danke ${safeCustomerName}, deine Bestellung ${safeOrderId} war erfolgreich.</p><ul>${lineItemsHtml}</ul><p>Total: CHF ${(params.totalCents / 100).toFixed(2)}</p>`,
  );

  if (owner) {
    await sendMail(
      owner,
      `Neue Bestellung ${safeOrderId}`,
      `<p>Bitte Bestellung bearbeiten und versenden.</p><ul>${lineItemsHtml}</ul><p>Einnahmen: CHF ${(params.totalCents / 100).toFixed(2)}</p>`,
    );
  }
}
