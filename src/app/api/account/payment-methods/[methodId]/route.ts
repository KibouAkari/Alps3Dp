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

const updatePaymentMethodSchema = z.object({
  last4: z.string().max(4).optional(),
  holderName: z.string().max(120).optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().min(2000).max(2100).optional(),
  isDefault: z.boolean().optional(),
});

// PATCH - Update payment method
export async function PATCH(
  request: Request,
  { params }: { params: { methodId: string } }
) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const method = await db.savedPaymentMethod.findUnique({
    where: { id: params.methodId },
  });

  if (!method || method.userId !== user.id) {
    return NextResponse.json({ error: "Zahlungsmethode nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePaymentMethodSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  // If setting as default, unset all other defaults
  if (parsed.data.isDefault) {
    await db.savedPaymentMethod.updateMany({
      where: { userId: user.id, id: { not: params.methodId } },
      data: { isDefault: false },
    });
  }

  const updated = await db.savedPaymentMethod.update({
    where: { id: params.methodId },
    data: parsed.data,
  });

  return NextResponse.json({
    id: updated.id,
    type: updated.type,
    last4: updated.last4,
    holderName: updated.holderName,
    expiryMonth: updated.expiryMonth,
    expiryYear: updated.expiryYear,
    isDefault: updated.isDefault,
    createdAt: updated.createdAt,
  });
}

// DELETE - Delete payment method
export async function DELETE(
  request: Request,
  { params }: { params: { methodId: string } }
) {
  const user = await getSessionUserFromToken(getCookieToken(request));

  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const method = await db.savedPaymentMethod.findUnique({
    where: { id: params.methodId },
  });

  if (!method || method.userId !== user.id) {
    return NextResponse.json({ error: "Zahlungsmethode nicht gefunden." }, { status: 404 });
  }

  await db.savedPaymentMethod.delete({
    where: { id: params.methodId },
  });

  return NextResponse.json({ success: true });
}
