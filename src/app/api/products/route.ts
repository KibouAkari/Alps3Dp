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
  images: z.array(z.string().url()).min(1),
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

export async function GET(request: Request) {
  const includeHidden = new URL(request.url).searchParams.get("includeHidden") === "1";

  const products = await db.product.findMany({
    where: includeHidden ? undefined : { isHidden: false },
    include: { images: true, category: true },
    orderBy: { createdAt: "desc" },
  });

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ products: products.map(mapProduct), categories });
}

export async function POST(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltige Produktdaten." }, { status: 400 });
  }

  const data = parsed.data;
  const baseSlug = makeSlug(data.title);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  let categoryId: string | undefined;
  const categoryName = data.category?.trim();
  if (categoryName) {
    const category = await db.category.upsert({
      where: { slug: makeSlug(categoryName) },
      create: { name: categoryName, slug: makeSlug(categoryName) },
      update: { name: categoryName },
    });
    categoryId = category.id;
  }

  const created = await db.product.create({
    data: {
      slug,
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

  return NextResponse.json({ product: mapProduct(created) }, { status: 201 });
}
