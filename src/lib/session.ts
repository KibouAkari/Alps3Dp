import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/security";

export const AUTH_COOKIE_NAME = "alps3dp.session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  salutation: string | null;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

export async function createSessionForUser(userId: string) {
  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.userSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getSessionUserFromToken(rawToken?: string | null): Promise<SessionUser | null> {
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashOpaqueToken(rawToken);

  const session = await db.userSession.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    salutation: session.user.salutation,
    name:
      [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") ||
      session.user.username ||
      session.user.email.split("@")[0] ||
      "User",
    email: session.user.email,
    role: session.user.role,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return getSessionUserFromToken(token);
}

export async function destroySession(rawToken?: string | null) {
  if (!rawToken) {
    return;
  }

  const tokenHash = hashOpaqueToken(rawToken);
  await db.userSession.deleteMany({ where: { tokenHash } });
}
