import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

const updateCartSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().nonnegative(),
    }),
  ),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

async function getAuthedUser(request: Request) {
  return getSessionUserFromToken(getCookieToken(request));
}

async function getOrCreateCart(userId: string) {
  return db.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function GET(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const cart = await db.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: true,
              category: true,
            },
          },
        },
      },
    },
  });

  const items = (cart?.items || []).map((entry: {
    productId: string;
    quantity: number;
    product: {
      id: string;
      slug: string;
      title: string;
      description: string;
      category: { name: string } | null;
      priceCents: number;
      salePriceCents: number | null;
      images: Array<{ sortOrder: number; url: string }>;
      stock: number;
    };
  }) => ({
    productId: entry.productId,
    quantity: entry.quantity,
    product: {
      id: entry.product.id,
      slug: entry.product.slug,
      title: entry.product.title,
      description: entry.product.description,
      category: entry.product.category?.name || "Unkategorisiert",
      priceCents: entry.product.priceCents,
      salePriceCents: entry.product.salePriceCents,
      images: entry.product.images
        .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
        .map((image: { url: string }) => image.url),
      stock: entry.product.stock,
    },
  }));

  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltiger Warenkorb." }, { status: 400 });
  }

  const cart = await getOrCreateCart(user.id);

  await db.cartItem.deleteMany({ where: { cartId: cart.id } });

  const validItems = parsed.data.items.filter((item) => item.quantity > 0);
  if (validItems.length > 0) {
    await db.cartItem.createMany({
      data: validItems.map((item) => ({
        cartId: cart.id,
        productId: item.productId,
        quantity: item.quantity,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
