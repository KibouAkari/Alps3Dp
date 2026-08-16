import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendLoginSuccessEmail, sendWelcomeEmail } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/security";
import { createSessionForUser, AUTH_COOKIE_NAME } from "@/lib/session";

// Verifies credentials and issues a new session cookie. Both IP-wide and
// per-account rate limits apply to slow down credential-stuffing attempts.
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

  const previousSessionCount = await db.userSession.count({ where: { userId: user.id } });

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

  if (previousSessionCount === 0) {
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      user.email.split("@")[0] ||
      "bei Alps3Dp";
    try {
      await sendWelcomeEmail({ to: user.email, name: displayName });
    } catch (error) {
      console.error("[auth:login:welcome-mail]", error);
    }
  } else {
    try {
      await sendLoginSuccessEmail(user.email);
    } catch (error) {
      console.error("[auth:login:mail]", error);
    }
  }

  return response;
}
