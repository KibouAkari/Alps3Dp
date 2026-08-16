import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashPassword, hashOpaqueToken, verifyPassword } from "@/lib/security";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

// Self-service password change while already signed in; requires re-entering
// the current password even though a valid session cookie is present.
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
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

  // A stolen session cookie shouldn't be enough to brute-force the current
  // password, so this is rate-limited per account in addition to per IP.
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit({
    namespace: "account-password",
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
  const parsed = updatePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: "Neues Passwort muss sich unterscheiden." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const passwordOk = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Aktuelles Passwort ist falsch." }, { status: 401 });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
    },
  });

  // Keep the current session alive but sign the account out everywhere else,
  // in case the old password had leaked and another session is compromised.
  const currentToken = getCookieToken(request);
  await db.userSession.deleteMany({
    where: {
      userId: user.id,
      ...(currentToken ? { tokenHash: { not: hashOpaqueToken(currentToken) } } : {}),
    },
  });

  return NextResponse.json({ success: true, message: "Passwort wurde aktualisiert." });
}
