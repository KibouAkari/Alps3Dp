import { NextResponse } from "next/server";
import { z } from "zod";

import { sendContactMessage } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Sends contact-form submissions to the shop owner via the shared mail
// sender (Resend/SMTP) configured in src/lib/mail.ts.
const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit({
    namespace: "contact-ip",
    identifier: ip,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bitte alle Felder korrekt ausfüllen." }, { status: 400 });
  }

  try {
    await sendContactMessage(parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact]", error);
    return NextResponse.json({ error: "Nachricht konnte nicht gesendet werden." }, { status: 502 });
  }
}
