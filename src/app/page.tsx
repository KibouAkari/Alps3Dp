// Storefront home page: fetches the initial product/category list on the
// server for fast first paint, then hands off to ShopClient for interactive
// filtering. Falls back to an empty catalog if the database is unreachable
// so the page still renders instead of crashing.
import { Marquee } from "@/components/marquee";
import { Parallax } from "@/components/parallax";
import { Reveal } from "@/components/reveal";
import { ShopClient } from "@/components/shop-client";
import { db } from "@/lib/db";
import { mapProduct } from "@/lib/product-mapper";

// Cache the storefront and revalidate it in the background instead of
// hitting the database on every single request.
export const revalidate = 60;

export default async function HomePage() {
  let initialProducts: ReturnType<typeof mapProduct>[] = [];
  let initialCategories: string[] = [];

  try {
    const [products, categories] = await Promise.all([
      db.product.findMany({
        where: { isHidden: false, deletedAt: null },
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
      <section className="hero-shell relative overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-10">
        <Parallax speed={0.08} className="pointer-events-none absolute -right-10 -top-10">
          <div className="float h-40 w-40 rounded-full bg-[var(--c-gray-light)] opacity-20 blur-3xl" aria-hidden="true" />
        </Parallax>
        <Reveal variant="up">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">3D Print Shop</p>
        </Reveal>
        <Reveal variant="up" delay={80}>
          <h1 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-[var(--fg)] sm:text-5xl">
            Handgefertigte 3D-gedruckte Produkte aus der Schweiz
          </h1>
        </Reveal>
        <Reveal variant="up" delay={160}>
          <p className="mt-4 max-w-2xl text-[var(--muted)]">
            Jedes Produkt wird auf Bestellung gedruckt und direkt zu dir geliefert.
          </p>
        </Reveal>
      </section>

      <Marquee className="py-2 text-sm font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
        {["PLA", "PETG", "Individuell bedruckt", "Schweizer Qualität", "Nachhaltig produziert", "Direktversand"].map((label) => (
          <span key={label} className="flex items-center gap-3">
            {label}
            <span className="h-1 w-1 rounded-full bg-[var(--c-gray)]" aria-hidden="true" />
          </span>
        ))}
      </Marquee>

      <ShopClient initialProducts={initialProducts} initialCategories={initialCategories} />
    </div>
  );
}
