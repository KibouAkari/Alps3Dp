import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(120),
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
    user: sessionUser,
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
    return NextResponse.json({ error: "Ungueltiger Name." }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: sessionUser.id },
    data: { name: parsed.data.name.trim() },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name || user.email.split("@")[0],
      email: user.email,
      role: user.role,
    },
  });
}
