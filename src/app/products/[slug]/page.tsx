import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { SafeImage } from "@/components/safe-image";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
import { db } from "@/lib/db";
import { mapProduct } from "@/lib/product-mapper";
import type { ProductWithRelations } from "@/lib/product-mapper";
import type { Product } from "@/lib/types";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dbProduct = await db.product.findUnique({
    where: { slug },
    include: {
      images: true,
      category: true,
    },
  });

  const product = dbProduct ? mapProduct(dbProduct) : null;

  if (!product) {
    notFound();
  }

  const relatedDb = await db.product.findMany({
    where: {
      isHidden: false,
      id: { not: product.id },
      categoryId: dbProduct?.categoryId || undefined,
    },
    include: { images: true, category: true },
    take: 4,
    orderBy: { createdAt: "desc" },
  });

  const moreDb = await db.product.findMany({
    where: {
      isHidden: false,
      id: { not: product.id },
    },
    include: { images: true, category: true },
    take: 6,
    orderBy: { createdAt: "desc" },
  });

  const related: Product[] = relatedDb.map((entry: ProductWithRelations) => mapProduct(entry));
  const moreProducts: Product[] = moreDb.map((entry: ProductWithRelations) => mapProduct(entry));
  const hasSale = Boolean(product.salePriceCents && product.salePriceCents < product.priceCents);

  return (
    <div className="space-y-8 fade-in-up">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <div className="relative h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-[460px]">
            <SafeImage src={product.images[0]} alt={product.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {product.images.map((image, index) => (
              <div key={image} className="relative h-20 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <SafeImage src={image} alt={`${product.title} Ansicht ${index + 1}`} fill className="object-cover" sizes="120px" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-sky-700">{product.category}</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{product.title}</h1>
          <p className="text-slate-600">{product.description}</p>
          <div className="pt-4">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-slate-900">{formatChf(getDisplayPriceCents(product))}</p>
              {hasSale && <p className="text-sm text-slate-400 line-through">{formatChf(product.priceCents)}</p>}
              {hasSale && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">Aktion</span>}
            </div>
            <p className="text-sm text-slate-500">Lager: {product.stock} Stk.</p>
          </div>
          <div className="grid gap-3 pt-4 sm:grid-cols-2">
            <Link href="/checkout" className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700">
              Jetzt kaufen
            </Link>
            <AddToCartButton productId={product.id} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Versandhinweis: Platzhaltertext fuer Lieferzeit, Rueckgabe und Materialinformationen.
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Ähnliche Produkte</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((entry: Product) => (
              <Link key={entry.id} href={`/products/${entry.slug}`} className="rounded-xl border border-slate-200 p-3 transition hover:-translate-y-0.5 hover:shadow">
                <div className="relative h-28 overflow-hidden rounded-md">
                  <SafeImage src={entry.images[0]} alt={entry.title} fill className="object-cover" sizes="220px" />
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-medium text-slate-900">{entry.title}</p>
                <p className="text-sm text-slate-600">{formatChf(getDisplayPriceCents(entry))}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {moreProducts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Weitere Produkte</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {moreProducts.map((entry: Product) => (
              <Link key={entry.id} href={`/products/${entry.slug}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50">
                <div className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200">
                  <SafeImage src={entry.images[0]} alt={entry.title} fill className="object-cover" sizes="64px" />
                </div>
                <div>
                  <p className="line-clamp-1 text-sm font-medium text-slate-900">{entry.title}</p>
                  <p className="text-xs text-slate-600">{formatChf(getDisplayPriceCents(entry))}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
