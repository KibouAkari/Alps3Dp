// Shared storefront helpers: currency formatting and sale-price resolution.
// Product data itself is served from the database (see src/lib/product-mapper.ts),
// not from this module.
import type { Product } from "@/lib/types";

/** Formats a price stored in centimes/cents as a localized Swiss franc amount. */
export function formatChf(priceCents: number) {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
}

/** Returns the sale price when one is set, otherwise the regular price. */
export function getDisplayPriceCents(product: Product) {
  return product.salePriceCents ?? product.priceCents;
}
