import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { mapProduct } from "@/lib/product-mapper";
import { makeSlug } from "@/lib/security";
import { getSessionUserFromToken, AUTH_COOKIE_NAME } from "@/lib/session";

const productSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(4).max(10000),
  category: z.string().trim().optional(),
  priceCents: z.number().int().positive(),
  salePriceCents: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative(),
  images: z
    .array(
      z
        .string()
        .min(1)
        .refine((value) => value.startsWith("data:image/") || /^https?:\/\//i.test(value), {
          message: "Ungültige Bildquelle.",
        })
    )
    .min(1),
  isHidden: z.boolean().optional(),
});

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

async function requireAdmin(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));
  return Boolean(user && user.role === "ADMIN");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Produktdaten." }, { status: 400 });
  }

  const { id } = await params;
  const data = parsed.data;

  let categoryId: string | null = null;
  const categoryName = data.category?.trim();
  if (categoryName) {
    const category = await db.category.upsert({
      where: { slug: makeSlug(categoryName) },
      create: { name: categoryName, slug: makeSlug(categoryName) },
      update: { name: categoryName },
    });
    categoryId = category.id;
  }

  await db.productImage.deleteMany({ where: { productId: id } });
  const updated = await db.product.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      categoryId,
      priceCents: data.priceCents,
      salePriceCents: data.salePriceCents ?? null,
      stock: data.stock,
      isHidden: data.isHidden ?? false,
      images: {
        create: data.images.map((url, index) => ({ url, sortOrder: index })),
      },
    },
    include: { images: true, category: true },
  });

  return NextResponse.json({ product: mapProduct(updated) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const { id } = await params;
  await db.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
