import { NextResponse } from "next/server";

import { db, lockUserForUpdate } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/security";

// Consumes a one-time email verification link. Tokens are single-use and
// time-limited, and only the hash is ever stored/looked up.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${url.origin}/auth/login?verified=missing`);
  }

  const tokenHash = hashOpaqueToken(token);
  const verified = await db.$transaction(async (tx) => {
    const record = await tx.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) return false;

    await lockUserForUpdate(tx, record.userId);
    const currentRecord = await tx.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        userId: record.userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!currentRecord) return false;

    await tx.user.update({
      where: { id: currentRecord.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.emailVerificationToken.update({
      where: { id: currentRecord.id },
      data: { usedAt: new Date() },
    });
    return true;
  });
  if (!verified) {
    return NextResponse.redirect(`${url.origin}/auth/login?verified=invalid`);
  }

  return NextResponse.redirect(`${url.origin}/auth/login?verified=ok`);
}
