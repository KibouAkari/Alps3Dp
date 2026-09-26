import Link from "next/link";
import { useState } from "react";

import { SafeImage } from "@/components/safe-image";
import { TiltCard } from "@/components/tilt-card";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
import type { Product } from "@/lib/types";

// Storefront grid tile: image, title, and price with sale-price styling.
type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const currentPrice = getDisplayPriceCents(product);
  const hasSale = Boolean(product.salePriceCents && product.salePriceCents < product.priceCents);

  return (
    <TiltCard className="h-full">
      <Link
        href={`/products/${product.slug}`}
        className="glass-hover group hover-lift block h-full overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm transition duration-300 hover:shadow-xl"
      >
        <div className="relative h-44 overflow-hidden bg-[var(--surface-soft)]">
          <SafeImage
            src={product.images[0]}
            alt={product.title}
            fill
            priority={priority}
            onLoad={() => setImageLoaded(true)}
            className="object-cover transition duration-500 ease-out group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className={`product-image-placeholder absolute inset-0 transition-opacity duration-200 ${imageLoaded ? "opacity-0" : ""}`} aria-hidden="true" />
          {hasSale && (
            <span className="absolute left-3 top-3 rounded-full bg-[var(--c-black)] px-2 py-1 text-xs font-semibold text-white">
              Aktion
            </span>
          )}
        </div>
        <div className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{product.category}</p>
          <h3 className="line-clamp-1 text-base font-semibold text-[var(--fg)]">{product.title}</h3>
          <p className="line-clamp-2 text-sm text-[var(--muted)]">{product.description}</p>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[var(--fg)]">{formatChf(currentPrice)}</span>
              {hasSale && <span className="text-xs text-[var(--muted)] line-through">{formatChf(product.priceCents)}</span>}
            </div>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}
