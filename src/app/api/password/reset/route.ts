import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashPassword, hashOpaqueToken } from "@/lib/security";

// Completes the reset-password flow started by /api/password/forgot. The
// token is single-use and expires, and every existing session for the user
// is invalidated once the password changes (see below).
const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit({
    namespace: "auth-reset-ip",
    identifier: ip,
    limit: 8,
    windowMs: 30 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte spaeter erneut versuchen." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  const tokenHash = hashOpaqueToken(parsed.data.token);
  const tokenRecord = await db.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!tokenRecord) {
    return NextResponse.json({ error: "Reset-Link ist ungueltig oder abgelaufen." }, { status: 400 });
  }

  await db.$transaction([
    db.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    db.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate every existing session so a leaked/old cookie stops working
    // once the password has been reset.
    db.userSession.deleteMany({ where: { userId: tokenRecord.userId } }),
  ]);

  return NextResponse.json({ success: true });
}
