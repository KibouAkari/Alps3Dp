import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendLoginSuccessEmail } from "@/lib/mail";
import { verifyPassword } from "@/lib/security";
import { createSessionForUser, AUTH_COOKIE_NAME } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Login-Daten." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
  }

  const { token, expiresAt } = await createSessionForUser(user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
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
