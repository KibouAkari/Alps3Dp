import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendVerifyEmail } from "@/lib/mail";
import { createOpaqueToken, hashOpaqueToken, verifyPassword } from "@/lib/security";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

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

  const taken = await db.user.findUnique({ where: { email: newEmail } });
  if (taken) {
    return NextResponse.json({ error: "E-Mail ist bereits vergeben." }, { status: 409 });
  }

  const verifyToken = createOpaqueToken();

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        emailVerifiedAt: null,
      },
    }),
    db.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(verifyToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendVerifyEmail(newEmail, `${appUrl}/api/auth/verify-email?token=${verifyToken}`);

  return NextResponse.json({
    success: true,
    email: newEmail,
    emailVerified: false,
    message: "E-Mail aktualisiert. Bitte neue Adresse verifizieren.",
  });
}
