import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/app-url";
import { sendWelcomeVerifyEmail } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashPassword, createOpaqueToken, hashOpaqueToken } from "@/lib/security";
import { createSessionForUser, AUTH_COOKIE_NAME } from "@/lib/session";

// Creates the account, sends the verification email, and signs the user in
// immediately so they can browse right away — email verification is only
// required later, at checkout.
const registerSchema = z.object({
  firstName: z.string().min(0).max(60).optional().default(""),
  lastName: z.string().min(0).max(60).optional().default(""),
  salutation: z.string().refine(v => !v || ["Herr", "Frau"].includes(v)).optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit({
    namespace: "auth-register-ip",
    identifier: ip,
    limit: 6,
    windowMs: 30 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Zu viele Registrierungen. Bitte spaeter erneut versuchen." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    const message = fields.has("email")
      ? "Bitte gib eine gültige E-Mail-Adresse ein."
      : fields.has("password")
        ? "Das Passwort muss mindestens 8 Zeichen lang sein."
        : fields.has("username")
          ? "Der Username muss 3–32 Zeichen lang sein (Buchstaben, Zahlen, . _ -)."
          : "Ungültige Eingaben.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username?.trim().toLowerCase() || null;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-Mail ist bereits registriert." }, { status: 409 });
  }

  if (username) {
    const existingUsername = await db.user.findFirst({ where: { username } });
    if (existingUsername) {
      return NextResponse.json({ error: "Username ist bereits vergeben." }, { status: 409 });
    }
  }

  const user = await db.user.create({
    data: {
      firstName: parsed.data.firstName?.trim() || null,
      lastName: parsed.data.lastName?.trim() || null,
      salutation: parsed.data.salutation || null,
      username,
      email,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  const verifyToken = createOpaqueToken();
  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashOpaqueToken(verifyToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const appUrl = getAppBaseUrl();
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.email.split("@")[0] ||
    "bei Alps3Dp";

  let verificationEmailAccepted = false;
  try {
    await sendWelcomeVerifyEmail({
      to: email,
      name: displayName,
      verifyUrl: `${appUrl}/api/auth/verify-email?token=${verifyToken}`,
    });
    verificationEmailAccepted = true;
  } catch {
    console.error("[auth:register:mail] Provider rejected or unavailable");
  }

  const { token, expiresAt } = await createSessionForUser(user.id);

  const response = NextResponse.json({
    verificationEmailAccepted,
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

  return response;
}
