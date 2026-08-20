import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { BuyNowButton } from "@/components/buy-now-button";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { SafeImage } from "@/components/safe-image";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
import { db } from "@/lib/db";
import { mapProduct } from "@/lib/product-mapper";

export const revalidate = 120;

type RecommendationRow = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  salePriceCents: number | null;
  categoryId: string | null;
  images: Array<{ url: string; sortOrder: number }>;
};

type ProductCardEntry = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  salePriceCents?: number;
  categoryId: string | null;
  image: string;
};

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dbProduct = await db.product.findUnique({
    where: { slug },
    include: {
      images: true,
      category: true,
    },
  });

  const product = dbProduct && !dbProduct.deletedAt ? mapProduct(dbProduct) : null;

  if (product) {
    // Fire-and-forget click tracking for the Monitoring & Analytics page —
    // never let a tracking failure block rendering the product page.
    db.product.update({ where: { id: product.id }, data: { clicks: { increment: 1 } } }).catch((error: unknown) => {
      console.error("[product:clicks]", error);
    });
  }

  if (!product) {
    notFound();
  }

  const recommendationPool = await db.product.findMany({
    where: {
      isHidden: false,
      deletedAt: null,
      id: { not: product.id },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      salePriceCents: true,
      categoryId: true,
      images: {
        select: {
          url: true,
          sortOrder: true,
        },
      },
    },
    take: 24,
    orderBy: { createdAt: "desc" },
  });

  const cardProducts: ProductCardEntry[] = recommendationPool.map((entry: RecommendationRow) => ({
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    priceCents: entry.priceCents,
    salePriceCents: entry.salePriceCents ?? undefined,
    categoryId: entry.categoryId,
    image:
      entry.images
        .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
        .map((image: { url: string }) => image.url)[0] || "/images/placeholder-product.svg",
  }));

  const related = cardProducts
    .filter((entry: ProductCardEntry) => Boolean(dbProduct?.categoryId) && entry.categoryId === dbProduct?.categoryId)
    .slice(0, 4);

  const relatedIds = new Set(related.map((entry: ProductCardEntry) => entry.id));
  const moreProducts = cardProducts.filter((entry: ProductCardEntry) => !relatedIds.has(entry.id)).slice(0, 6);

  const hasSale = Boolean(product.salePriceCents && product.salePriceCents < product.priceCents);

  return (
    <div className="space-y-8 fade-in-up">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <ProductImageGallery images={product.images} title={product.title} />

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
            <BuyNowButton productId={product.id} />
            <AddToCartButton productId={product.id} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Versandhinweis: Platzhaltertext für Lieferzeit, Rückgabe und Materialinformationen.
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Ähnliche Produkte</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((entry: ProductCardEntry) => (
              <Link key={entry.id} href={`/products/${entry.slug}`} className="rounded-xl border border-slate-200 p-3 transition hover:-translate-y-0.5 hover:shadow">
                <div className="relative h-28 overflow-hidden rounded-md">
                  <SafeImage src={entry.image} alt={entry.title} fill className="object-cover" sizes="220px" />
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-medium text-slate-900">{entry.title}</p>
                <p className="text-sm text-slate-600">{formatChf(entry.salePriceCents ?? entry.priceCents)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {moreProducts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Weitere Produkte</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {moreProducts.map((entry: ProductCardEntry) => (
              <Link key={entry.id} href={`/products/${entry.slug}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-slate-50">
                <div className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200">
                  <SafeImage src={entry.image} alt={entry.title} fill className="object-cover" sizes="64px" />
                </div>
                <div>
                  <p className="line-clamp-1 text-sm font-medium text-slate-900">{entry.title}</p>
                  <p className="text-xs text-slate-600">{formatChf(entry.salePriceCents ?? entry.priceCents)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
