import type { Product } from "@/lib/types";

export const categories: string[] = [];

export const demoProducts: Product[] = [];

export function getProductBySlug(slug: string) {
  return demoProducts.find((product) => product.slug === slug);
}

export function formatChf(priceCents: number) {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
}

export function getDisplayPriceCents(product: Product) {
  return product.salePriceCents ?? product.priceCents;
}
