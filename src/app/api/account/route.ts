import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  salutation: z.enum(["Herr", "Frau"]).optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUserFromToken(getCookieToken(request));

  if (!sessionUser) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const fullUser = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      salutation: true,
      username: true,
      email: true,
      emailVerifiedAt: true,
      addresses: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          salutation: true,
          firstName: true,
          lastName: true,
          street: true,
          zipCode: true,
          city: true,
          country: true,
          isDefault: true,
          createdAt: true,
        },
      },
      savedPaymentMethods: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          last4: true,
          holderName: true,
          expiryMonth: true,
          expiryYear: true,
          isDefault: true,
          createdAt: true,
        },
      },
    },
  });

  if (!fullUser) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const orders = await db.order.findMany({
    where: { userId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      status: true,
      totalCents: true,
    },
  });

  return NextResponse.json({
    profile: {
      id: fullUser.id,
      firstName: fullUser.firstName,
      lastName: fullUser.lastName,
      salutation: fullUser.salutation,
      username: fullUser.username,
      email: fullUser.email,
      emailVerified: Boolean(fullUser.emailVerifiedAt),
      addresses: fullUser.addresses,
      paymentMethods: fullUser.savedPaymentMethods,
    },
    orders: orders.map((entry: { id: string; createdAt: Date; status: string; totalCents: number }) => ({
      id: entry.id,
      date: entry.createdAt,
      status: entry.status,
      totalCents: entry.totalCents,
    })),
  });
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUserFromToken(getCookieToken(request));

  if (!sessionUser) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  if (parsed.data.username) {
    const normalized = parsed.data.username.trim().toLowerCase();
    const existing = await db.user.findFirst({
      where: {
        username: normalized,
        id: { not: sessionUser.id },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Username ist bereits vergeben." }, { status: 409 });
    }
  }

  const updatedUser = await db.user.update({
    where: { id: sessionUser.id },
    data: {
      firstName: parsed.data.firstName ?? undefined,
      lastName: parsed.data.lastName ?? undefined,
      salutation: parsed.data.salutation ?? undefined,
      username: parsed.data.username ? parsed.data.username.trim().toLowerCase() : undefined,
    },
  });

  return NextResponse.json({
    id: updatedUser.id,
    username: updatedUser.username,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    salutation: updatedUser.salutation,
    name:
      [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(" ") ||
      updatedUser.username ||
      updatedUser.email.split("@")[0],
    email: updatedUser.email,
    emailVerified: Boolean(updatedUser.emailVerifiedAt),
  });
}
