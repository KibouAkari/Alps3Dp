import Link from "next/link";

import { SafeImage } from "@/components/safe-image";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
import type { Product } from "@/lib/types";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const currentPrice = getDisplayPriceCents(product);
  const hasSale = Boolean(product.salePriceCents && product.salePriceCents < product.priceCents);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group hover-lift overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:shadow-lg"
    >
      <div className="relative h-44 overflow-hidden">
        <SafeImage
          src={product.images[0]}
          alt={product.title}
          fill
          className="object-cover transition duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        {hasSale && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white">
            Aktion
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs uppercase tracking-wide text-sky-700">{product.category}</p>
        <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{product.title}</h3>
        <p className="line-clamp-2 text-sm text-slate-500">{product.description}</p>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{formatChf(currentPrice)}</span>
            {hasSale && <span className="text-xs text-slate-400 line-through">{formatChf(product.priceCents)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
