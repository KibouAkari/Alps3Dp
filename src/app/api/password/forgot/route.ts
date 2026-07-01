import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/security";

const forgotSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRateLimit = checkRateLimit({
    namespace: "auth-forgot-ip",
    identifier: ip,
    limit: 8,
    windowMs: 30 * 60 * 1000,
  });
  if (ipRateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte spaeter erneut versuchen." },
      {
        status: 429,
        headers: { "Retry-After": String(ipRateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige E-Mail." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const emailRateLimit = checkRateLimit({
    namespace: "auth-forgot-email",
    identifier: `${ip}:${email}`,
    limit: 3,
    windowMs: 30 * 60 * 1000,
  });
  if (emailRateLimit.limited) {
    return NextResponse.json(
      { success: true },
      {
        headers: { "Retry-After": String(emailRateLimit.retryAfterSeconds) },
      },
    );
  }

  const user = await db.user.findUnique({ where: { email } });

  if (user) {
    const token = createOpaqueToken();

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const appUrl = getAppBaseUrl();
    await sendPasswordResetEmail(email, `${appUrl}/auth/reset-password?token=${token}`);
  }

  return NextResponse.json({ success: true });
}
