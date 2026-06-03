import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/security";

const forgotSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige E-Mail." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (user) {
    const token = createOpaqueToken();

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendPasswordResetEmail(email, `${appUrl}/auth/reset-password?token=${token}`);
  }

  return NextResponse.json({ success: true });
}
