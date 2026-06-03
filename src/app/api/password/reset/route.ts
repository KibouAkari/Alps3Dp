import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword, hashOpaqueToken } from "@/lib/security";

const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  const tokenHash = hashOpaqueToken(parsed.data.token);
  const tokenRecord = await db.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!tokenRecord) {
    return NextResponse.json({ error: "Reset-Link ist ungueltig oder abgelaufen." }, { status: 400 });
  }

  await db.$transaction([
    db.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    db.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
