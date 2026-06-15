import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/app-url";
import { sendVerifyEmail } from "@/lib/mail";
import { hashPassword, createOpaqueToken, hashOpaqueToken } from "@/lib/security";
import { createSessionForUser, AUTH_COOKIE_NAME } from "@/lib/session";

const registerSchema = z.object({
  firstName: z.string().min(0).max(60).optional().default(""),
  lastName: z.string().min(0).max(60).optional().default(""),
  salutation: z.string().refine(v => !v || ["Herr", "Frau"].includes(v)).optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
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
  await sendVerifyEmail(email, `${appUrl}/api/auth/verify-email?token=${verifyToken}`);

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

  return response;
}
