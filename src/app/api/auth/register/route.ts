import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendVerifyEmail } from "@/lib/mail";
import { hashPassword, createOpaqueToken, hashOpaqueToken } from "@/lib/security";
import { createSessionForUser, AUTH_COOKIE_NAME } from "@/lib/session";

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-Mail ist bereits registriert." }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      name: parsed.data.name.trim(),
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendVerifyEmail(email, `${appUrl}/api/auth/verify-email?token=${verifyToken}`);

  const { token, expiresAt } = await createSessionForUser(user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
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
