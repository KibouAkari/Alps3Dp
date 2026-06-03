import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function POST(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));
  if (!user) {
    return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Eingaben." }, { status: 400 });
  }

  const cart = await db.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });

  const product = await db.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product || product.isHidden) {
    return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
  }

  const existing = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: parsed.data.productId } },
  });

  if (existing) {
    await db.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + parsed.data.quantity },
    });
  } else {
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
      },
    });
  }

  return NextResponse.json({ success: true });
}
