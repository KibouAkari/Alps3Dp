"use client";

import { useEffect, useMemo, useState } from "react";

import { ProductCard } from "@/components/product-card";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
import type { Product } from "@/lib/types";

type SortMode = "relevance" | "price-asc" | "price-desc" | "newest";

type ProductsResponse = {
  products: Product[];
  categories: Array<{ id: string; name: string; slug: string }>;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function FilterGroup({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        {title}
        <ChevronIcon open={open} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function ShopClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [maxPrice, setMaxPrice] = useState(35);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [onlySale, setOnlySale] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then(async (response) => {
        const data = (await response.json()) as ProductsResponse;
        if (!response.ok) {
          throw new Error("Produkte konnten nicht geladen werden.");
        }
        setProducts(data.products || []);
        setCategories((data.categories || []).map((entry) => entry.name));
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Produkte konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  const availableCategories = useMemo(() => ["All", ...categories], [categories]);

  const visibleProducts = useMemo(() => products.filter((product) => !product.isHidden), [products]);

  const maxAvailablePrice = useMemo(() => {
    if (visibleProducts.length === 0) {
      return 35;
    }

    const maxCents = Math.max(...visibleProducts.map((product) => getDisplayPriceCents(product)));
    return Math.max(1, Math.ceil(maxCents / 100));
  }, [visibleProducts]);

  const minSliderPrice = useMemo(() => Math.min(5, maxAvailablePrice), [maxAvailablePrice]);

  useEffect(() => {
    setMaxPrice((current) => {
      if (current > maxAvailablePrice) {
        return maxAvailablePrice;
      }
      if (current === 35 && maxAvailablePrice !== 35) {
        return maxAvailablePrice;
      }
      return current;
    });
  }, [maxAvailablePrice]);

  const filteredProducts = useMemo(() => {
    const base = products.filter((product) => {
      if (product.isHidden) {
        return false;
      }

      const matchesQuery =
        product.title.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      const matchesPrice = (product.salePriceCents ?? product.priceCents) <= maxPrice * 100;
      const matchesSale = !onlySale || Boolean(product.salePriceCents && product.salePriceCents < product.priceCents);
      return matchesQuery && matchesCategory && matchesPrice && matchesSale;
    });

    if (sortMode === "price-asc") {
      return [...base].sort((a, b) => getDisplayPriceCents(a) - getDisplayPriceCents(b));
    }
    if (sortMode === "price-desc") {
      return [...base].sort((a, b) => getDisplayPriceCents(b) - getDisplayPriceCents(a));
    }
    if (sortMode === "newest") {
      return [...base].reverse();
    }
    return base;
  }, [maxPrice, onlySale, products, query, selectedCategory, sortMode]);

  const hasActiveFilters = query || selectedCategory !== "All" || sortMode !== "relevance" || maxPrice !== maxAvailablePrice || onlySale;

  const resetAll = () => {
    setQuery("");
    setSelectedCategory("All");
    setSortMode("relevance");
    setMaxPrice(maxAvailablePrice);
    setOnlySale(false);
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="fade-in-up grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="panel-surface h-fit rounded-2xl p-4 shadow-sm lg:sticky lg:top-20">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Filter</h2>
          {hasActiveFilters && (
            <button type="button" onClick={resetAll} className="text-xs text-sky-600 hover:underline">
              Zurücksetzen
            </button>
          )}
        </div>

        <div className="space-y-0">
          <FilterGroup title="Suche">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Produkt suchen..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
            />
          </FilterGroup>

          <FilterGroup title="Kategorie">
            <div className="space-y-1">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                    selectedCategory === category
                      ? "bg-sky-50 font-medium text-sky-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {category === "All" ? "Alle Kategorien" : category}
                </button>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Sortierung">
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-sky-500 transition focus:ring"
            >
              <option value="relevance">Relevanz</option>
              <option value="price-asc">Preis aufsteigend</option>
              <option value="price-desc">Preis absteigend</option>
              <option value="newest">Neueste zuerst</option>
            </select>
          </FilterGroup>

          <FilterGroup title="Max. Preis">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{formatChf(minSliderPrice * 100)}</span>
                <span className="font-medium text-slate-700">{formatChf(maxPrice * 100)}</span>
              </div>
              <input
                type="range"
                min={minSliderPrice}
                max={maxAvailablePrice}
                step={1}
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value))}
                className="w-full accent-sky-600"
              />
            </div>
          </FilterGroup>

          <FilterGroup title="Aktionen" defaultOpen={false}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlySale}
                onChange={(e) => setOnlySale(e.target.checked)}
                className="h-4 w-4 accent-sky-600"
              />
              Nur Aktionspreise anzeigen
            </label>
          </FilterGroup>
        </div>
      </aside>

      <div className="space-y-4">
        {loadError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {query && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                Suche: {query}
                <button type="button" onClick={() => setQuery("")} aria-label="Suche entfernen" className="ml-1 hover:text-slate-900">
                  x
                </button>
              </span>
            )}
            {selectedCategory !== "All" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory("All")} aria-label="Kategorie entfernen" className="ml-1 hover:text-slate-900">
                  x
                </button>
              </span>
            )}
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="panel-soft rounded-xl p-6 text-center text-sm text-slate-500">
            Keine Produkte gefunden.
          </div>
        )}
      </div>
    </section>
  );
}
