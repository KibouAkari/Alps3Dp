// Storefront home page: fetches the initial product/category list on the
// server for fast first paint, then hands off to ShopClient for interactive
// filtering. Falls back to an empty catalog if the database is unreachable
// so the page still renders instead of crashing.
import { ShopClient } from "@/components/shop-client";
import { db } from "@/lib/db";
import { mapProduct } from "@/lib/product-mapper";

export default async function HomePage() {
  let initialProducts: ReturnType<typeof mapProduct>[] = [];
  let initialCategories: string[] = [];

  try {
    const [products, categories] = await Promise.all([
      db.product.findMany({
        where: { isHidden: false },
        include: { images: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      db.category.findMany({
        orderBy: { name: "asc" },
        select: { name: true },
      }),
    ]);

    initialProducts = products.map(mapProduct);
    initialCategories = categories.map((entry: { name: string }) => entry.name);
  } catch {
    initialProducts = [];
    initialCategories = [];
  }

  return (
    <div className="space-y-8 immersive-rise">
      <section className="hero-shell overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-10">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-700">3D Print Shop</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Handgefertigte 3D-gedruckte Produkte aus der Schweiz
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Jedes Produkt wird auf Bestellung gedruckt und direkt zu dir geliefert.
        </p>
      </section>
      <ShopClient initialProducts={initialProducts} initialCategories={initialCategories} />
    </div>
  );
}
