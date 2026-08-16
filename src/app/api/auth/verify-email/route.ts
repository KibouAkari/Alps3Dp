import { NextResponse } from "next/server";

import { db } from "@/lib/db";
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
  const record = await db.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    return NextResponse.redirect(`${url.origin}/auth/login?verified=invalid`);
  }

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.redirect(`${url.origin}/auth/login?verified=ok`);
}
