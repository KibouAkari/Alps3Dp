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

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await db.$transaction(async (tx) => {
      // Atomically claim the token before changing anything. Concurrent
      // reset requests cannot both consume the same one-time token.
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: tokenRecord.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new Error("Reset token already consumed");
      }
      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: tokenRecord.userId, usedAt: null },
      });
      // Revoke every existing session after the password is changed.
      await tx.userSession.deleteMany({ where: { userId: tokenRecord.userId } });
    });
  } catch {
    // Do not leak database details or valid-user/token information.
    return NextResponse.json({ error: "Reset-Link ist ungueltig oder abgelaufen." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
