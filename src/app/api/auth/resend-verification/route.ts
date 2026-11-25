import { NextResponse } from "next/server";

import { getConfiguredAppBaseUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { sendVerifyEmail } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/security";
import { getSessionTokenFromRequest, getSessionUserFromToken } from "@/lib/session";

// Recover the verification link for a signed-in, unverified account.
// No arbitrary recipient parameter; sends only to this account's email.
export async function POST(request: Request) {
  const session = await getSessionUserFromToken(getSessionTokenFromRequest(request));
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const ipRate = checkRateLimit({
    namespace: "verify-resend-ip",
    identifier: getClientIp(request),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  const accountRate = checkRateLimit({
    namespace: "verify-resend-account",
    identifier: session.id,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (ipRate.limited || accountRate.limited) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429, headers: {
        "Retry-After": String(Math.max(ipRate.retryAfterSeconds, accountRate.retryAfterSeconds)),
      } },
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ success: true, alreadyVerified: true });

  const token = createOpaqueToken();
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    db.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  try {
    await sendVerifyEmail(user.email, `${getConfiguredAppBaseUrl().replace(/\/$/, "")}/api/auth/verify-email?token=${token}`);
  } catch {
    console.error("[auth:resend-verification] Mail provider rejected verification");
    return NextResponse.json({ error: "E-Mail konnte momentan nicht versendet werden." }, { status: 503 });
  }
  return NextResponse.json({ success: true, accepted: true });
}
