import type { Product } from "@/lib/types";

export type ProductWithRelations = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  isHidden: boolean;
  clicks: number;
  images: Array<{ url: string; sortOrder: number }>;
  category: { name: string } | null;
};

export function mapProduct(product: ProductWithRelations): Product {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    priceCents: product.priceCents,
    salePriceCents: product.salePriceCents ?? undefined,
    category: product.category?.name || "Unkategorisiert",
    images: product.images.sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder).map((entry: { url: string }) => entry.url),
    stock: product.stock,
    clicks: product.clicks,
    sold: 0,
    isHidden: product.isHidden,
  };
}
