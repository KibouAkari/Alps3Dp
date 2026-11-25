/**
 * Pure email transport helpers so delivery behavior is tested without
 * contacting Resend, SMTP, customer accounts or a production database.
 */

export type MailProvider = "resend" | "smtp";

export function selectMailProvider(config: {
  choice?: string;
  resendKey?: string;
  smtpReady: boolean;
}): MailProvider | null {
  const choice = config.choice?.trim().toLowerCase();
  if (choice && choice !== "resend" && choice !== "smtp") {
    throw new Error("Invalid MAIL_PROVIDER: expected resend or smtp");
  }
  const resendReady = Boolean(config.resendKey?.trim());
  if (choice === "resend") return resendReady ? "resend" : null;
  if (choice === "smtp") return config.smtpReady ? "smtp" : null;
  return resendReady ? "resend" : config.smtpReady ? "smtp" : null;
}

export function assertResendAccepted(result: {
  data?: { id?: string } | null;
  error?: { name?: string } | null;
}): void {
  if (result.error) {
    // Provider error names are bounded to safe characters; never print a raw
    // message, response payload or recipient-specific details.
    const errorName = result.error.name || "";
    const safeName = /^[a-zA-Z0-9_-]{1,48}$/.test(errorName)
      ? errorName : "provider_error";
    throw new Error(\`Resend: \${safeName}\`);
  }
  if (!result.data?.id) {
    throw new Error("Resend: missing_delivery_id");
  }
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    nbsp: " ", "#039": "'", ndash: "–", mdash: "—",
  };
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, entity: string) => {
    const key = entity.toLowerCase();
    if (named[key]) return named[key];
    if (key.startsWith("#")) {
      const number = key.startsWith("#x")
        ? Number.parseInt(key.slice(2), 16)
        : Number.parseInt(key.slice(1), 10);
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number) : whole;
    }
    return whole;
  });
}

/**
 * Text alternative for server-rendered, trusted transactional HTML.
 * Preserves link destinations and order line breaks without any dependency
 * or remote service; doesn't attempt to render arbitrary HTML.
 */
export function htmlToPlainText(html: string): string {
  const withoutPreheader = html.replace(
    /<span[^>]*style="[^"]*display:none[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "",
  );
  const withLinks = withoutPreheader.replace(
    /<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (_match, _before, href: string, _after, label: string) => {
      const cleanLabel = decodeEntities(label.replace(/<[^>]*>/g, "").trim());
      const destination = decodeEntities(href);
      return cleanLabel === destination ? destination : \`\${cleanLabel} (\${destination})\`;
    },
  );
  const text = withLinks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|tr|table|li)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1]?.length))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}
