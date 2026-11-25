import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { db, lockUserForUpdate } from "@/lib/db";
import { sendVerifyEmail } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createOpaqueToken, hashOpaqueToken, verifyPassword } from "@/lib/security";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

// Changing the email requires the current password and re-verification of
// the new address before it becomes the account's email of record.
const updateEmailSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string().min(1),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUserFromToken(getCookieToken(request));
  if (!sessionUser) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit({
    namespace: "account-email",
    identifier: `${ip}:${sessionUser.id}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte spaeter erneut versuchen." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const passwordOk = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Aktuelles Passwort ist falsch." }, { status: 401 });
  }

  const newEmail = parsed.data.newEmail.trim().toLowerCase();
  if (newEmail === user.email) {
    return NextResponse.json({ error: "Neue E-Mail ist identisch zur aktuellen." }, { status: 400 });
  }

  const verifyToken = createOpaqueToken();

  const result = await db.$transaction(async (tx) => {
    await lockUserForUpdate(tx, user.id);
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true },
    });
    if (!currentUser) return "missing" as const;
    if (currentUser.email === newEmail) return "same" as const;

    const taken = await tx.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (taken) return "taken" as const;

    await tx.emailVerificationToken.deleteMany({ where: { userId: currentUser.id } });
    await tx.user.update({
      where: { id: currentUser.id },
      data: {
        email: newEmail,
        emailVerifiedAt: null,
      },
    });
    await tx.emailVerificationToken.create({
      data: {
        userId: currentUser.id,
        tokenHash: hashOpaqueToken(verifyToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return "updated" as const;
  });
  if (result === "missing") {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }
  if (result === "same") {
    return NextResponse.json({ error: "Neue E-Mail ist identisch zur aktuellen." }, { status: 400 });
  }
  if (result === "taken") {
    return NextResponse.json({ error: "E-Mail ist bereits vergeben." }, { status: 409 });
  }

  const appUrl = getAppBaseUrl();
  let verificationEmailAccepted = false;
  try {
    await sendVerifyEmail(newEmail, `${appUrl}/api/auth/verify-email?token=${verifyToken}`);
    verificationEmailAccepted = true;
  } catch {
    console.error("[account:email-change] Verification mail provider unavailable");
  }

  return NextResponse.json({
    success: true,
    verificationEmailAccepted,
    email: newEmail,
    emailVerified: false,
    message: verificationEmailAccepted
      ? "E-Mail aktualisiert. Bitte neue Adresse verifizieren."
      : "E-Mail geändert, aber der Versand ist fehlgeschlagen. Bitte im Konto die Verifizierung erneut anfordern.",
  });
}
