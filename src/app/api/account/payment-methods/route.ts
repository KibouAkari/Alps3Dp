import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

const createPaymentMethodSchema = z.object({
  type: z.enum(["card", "twint"]),
  last4: z.string().max(4).optional(),
  holderName: z.string().max(120).optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().min(2000).max(2100).optional(),
  isDefault: z.boolean().optional(),
});

// GET - Retrieve all payment methods for user
export async function GET(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const methods = await db.savedPaymentMethod.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
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
  });

  return NextResponse.json({ methods });
}

// POST - Create new payment method
export async function POST(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createPaymentMethodSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  // If setting as default, unset all other defaults
  if (parsed.data.isDefault) {
    await db.savedPaymentMethod.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const method = await db.savedPaymentMethod.create({
    data: {
      userId: user.id,
      ...parsed.data,
    },
  });

  return NextResponse.json(
    {
      id: method.id,
      type: method.type,
      last4: method.last4,
      holderName: method.holderName,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      isDefault: method.isDefault,
      createdAt: method.createdAt,
    },
    { status: 201 }
  );
}
