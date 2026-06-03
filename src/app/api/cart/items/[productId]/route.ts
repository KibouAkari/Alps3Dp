import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

const updateSchema = z.object({
  quantity: z.number().int().nonnegative(),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

async function getCartId(userId: string) {
  const cart = await db.cart.findUnique({ where: { userId } });
  return cart?.id;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getSessionUserFromToken(getCookieToken(request));
  if (!user) {
    return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Menge." }, { status: 400 });
  }

  const cartId = await getCartId(user.id);
  if (!cartId) {
    return NextResponse.json({ success: true });
  }

  const { productId } = await params;

  if (parsed.data.quantity === 0) {
    await db.cartItem.deleteMany({ where: { cartId, productId } });
    return NextResponse.json({ success: true });
  }

  await db.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity: parsed.data.quantity },
    update: { quantity: parsed.data.quantity },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getSessionUserFromToken(getCookieToken(request));
  if (!user) {
    return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
  }

  const cartId = await getCartId(user.id);
  if (!cartId) {
    return NextResponse.json({ success: true });
  }

  const { productId } = await params;
  await db.cartItem.deleteMany({ where: { cartId, productId } });
  return NextResponse.json({ success: true });
}
