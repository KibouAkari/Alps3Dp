import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendLoginSuccessEmail } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/security";
import { createSessionForUser, AUTH_COOKIE_NAME } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRateLimit = checkRateLimit({
    namespace: "auth-login-ip",
    identifier: ip,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (ipRateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Login-Versuche. Bitte spaeter erneut versuchen." },
      {
        status: 429,
        headers: { "Retry-After": String(ipRateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Login-Daten." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const accountRateLimit = checkRateLimit({
    namespace: "auth-login-account",
    identifier: `${ip}:${email}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (accountRateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Login-Versuche. Bitte spaeter erneut versuchen." },
      {
        status: 429,
        headers: { "Retry-After": String(accountRateLimit.retryAfterSeconds) },
      },
    );
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
  }

  const { token, expiresAt } = await createSessionForUser(user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      avatarUrl: user.avatarUrl,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      salutation: user.salutation,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.email.split("@")[0],
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
    },
  });

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await sendLoginSuccessEmail(user.email);

  return response;
}
