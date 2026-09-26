"use client";

// Storefront grid: search, category, and sort filters applied client-side
// over a product list that's fetched once and then refined in the browser.
import { useEffect, useMemo, useState } from "react";

import { ProductCard } from "@/components/product-card";
import { FilterMenuIcon } from "@/components/icons";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
import { parseJsonSafely } from "@/lib/fetch-json";
import type { Product } from "@/lib/types";

type SortMode = "relevance" | "price-asc" | "price-desc" | "newest";

type ProductsResponse = {
  products: Product[];
  categories: Array<{ id: string; name: string; slug: string }>;
};

type ShopClientProps = {
  initialProducts?: Product[];
  initialCategories?: string[];
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-CH")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getSearchScore(product: Product, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const title = normalizeSearchText(product.title);
  const searchableText = `${title} ${normalizeSearchText(product.description)} ${normalizeSearchText(product.category)}`;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!terms.every((term) => searchableText.includes(term))) return -1;
  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  if (title.includes(normalizedQuery)) return 2;
  if (terms.every((term) => title.includes(term))) return 3;
  return 4;
}

function matchesSearchQuery(product: Product, query: string) {
  return getSearchScore(product, query) >= 0;
}

function FilterGroup({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--surface-border)] pb-3 last:border-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press flex w-full items-center justify-between py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--fg)]"
        aria-expanded={open}
      >
        {title}
        <span className="accordion-chevron" data-open={open}>
          <ChevronIcon open={false} />
        </span>
      </button>
      <div className="accordion-content" data-open={open}>
        <div><div className="mt-2">{children}</div></div>
      </div>
    </div>
  );
}

export function ShopClient({ initialProducts = [], initialCategories = [] }: ShopClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [maxPrice, setMaxPrice] = useState(35);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [onlySale, setOnlySale] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  useEffect(() => {
    if (initialProducts.length > 0) {
      return;
    }

    fetch("/api/products")
      .then(async (response) => {
        const data = (await parseJsonSafely(response)) as Partial<ProductsResponse>;
        if (!response.ok) {
          throw new Error("Produkte konnten nicht geladen werden.");
        }
        setProducts(data.products || []);
        setCategories((data.categories || []).map((entry) => entry.name));
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Produkte konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [initialProducts.length]);

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

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return [];

    return visibleProducts
      .filter((product) => {
        const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
        const matchesPrice = (product.salePriceCents ?? product.priceCents) <= maxPrice * 100;
        const matchesSale = !onlySale || Boolean(product.salePriceCents && product.salePriceCents < product.priceCents);
        return matchesCategory && matchesPrice && matchesSale;
      })
      .map((product) => ({ product, score: getSearchScore(product, query) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score || a.product.title.localeCompare(b.product.title, "de-CH"))
      .slice(0, 5)
      .map((entry) => entry.product);
  }, [maxPrice, onlySale, query, selectedCategory, visibleProducts]);

  const showSuggestions = isSearchFocused && query.trim().length >= 2 && suggestions.length > 0;

  const selectSuggestion = (product: Product) => {
    setQuery(product.title);
    setActiveSuggestionIndex(-1);
    setIsSearchFocused(false);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestionIndex]);
    } else if (event.key === "Escape") {
      setIsSearchFocused(false);
      setActiveSuggestionIndex(-1);
    }
  };

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

      const matchesQuery = matchesSearchQuery(product, query);
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
            <div key={index} className="skeleton h-64" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="fade-in-up space-y-4">
      <div className={`grid gap-6 ${isFilterOpen ? "lg:grid-cols-[260px_minmax(0,1fr)]" : "lg:grid-cols-[auto_minmax(0,1fr)]"}`}>
        <div className="h-fit lg:sticky lg:top-6">
          {!isFilterOpen ? (
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="filter-toggle-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[var(--muted)]"
              aria-expanded={false}
            >
              <FilterMenuIcon className="h-4 w-4" />
              Filter
              {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-neutral-700" aria-hidden="true" />}
            </button>
          ) : (
          <aside className="filter-panel-enter panel-surface rounded-2xl p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
                <FilterMenuIcon className="h-4 w-4" />
                Filter
              </span>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button type="button" onClick={resetAll} className="text-xs text-neutral-900 hover:underline">
                    Zurücksetzen
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="filter-collapse-link text-xs font-medium"
                  aria-expanded={true}
                  aria-label="Filter einklappen"
                >
                  Einklappen
                </button>
              </div>
            </div>

        <div className="space-y-0">
          <FilterGroup title="Kategorie">
            <div className="space-y-1">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`press block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                    selectedCategory === category
                      ? "bg-[var(--accent-soft)] font-medium text-[var(--fg)]"
                      : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--fg)]"
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
              className="field-input"
            >
              <option value="relevance">Relevanz</option>
              <option value="price-asc">Preis aufsteigend</option>
              <option value="price-desc">Preis absteigend</option>
              <option value="newest">Neueste zuerst</option>
            </select>
          </FilterGroup>

          <FilterGroup title="Max. Preis">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span>{formatChf(minSliderPrice * 100)}</span>
                <span className="font-semibold text-[var(--fg)]">{formatChf(maxPrice * 100)}</span>
              </div>
              <input
                type="range"
                min={minSliderPrice}
                max={maxAvailablePrice}
                step={1}
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value))}
                className="price-slider"
                style={{
                  "--slider-fill": `${maxAvailablePrice > minSliderPrice ? ((maxPrice - minSliderPrice) / (maxAvailablePrice - minSliderPrice)) * 100 : 100}%`,
                } as React.CSSProperties}
              />
            </div>
          </FilterGroup>

          <FilterGroup title="Aktionen" defaultOpen={false}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={onlySale}
                onChange={(e) => setOnlySale(e.target.checked)}
                className="h-4 w-4 accent-neutral-900"
              />
              Nur Aktionspreise anzeigen
            </label>
          </FilterGroup>
        </div>
          </aside>
          )}
        </div>

        <div className="min-w-0 space-y-4">
        <div className="relative z-20">
          <div className="shop-search-shell relative flex h-11 items-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 shadow-sm">
            <span className="mr-3 text-[var(--muted)]"><SearchIcon /></span>
            <input
              id="shop-product-search"
              type="search"
              role="combobox"
              aria-label="Produkte suchen"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls="shop-product-suggestions"
              aria-activedescendant={showSuggestions && activeSuggestionIndex >= 0 ? `shop-suggestion-${activeSuggestionIndex}` : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 120)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Produkte suchen..."
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveSuggestionIndex(-1);
                }}
                aria-label="Suche leeren"
                className="press ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--fg)]"
              >
                ×
              </button>
            )}
          </div>
          {showSuggestions && (
            <ul id="shop-product-suggestions" role="listbox" className="shop-search-suggestions absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-1.5 shadow-xl">
              {suggestions.map((product, index) => (
                <li key={product.id} role="presentation">
                  <button
                    id={`shop-suggestion-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeSuggestionIndex === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    onClick={() => selectSuggestion(product)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${activeSuggestionIndex === index ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]"}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--surface-soft)] text-[var(--muted)]"><SearchIcon /></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)]">{product.title}</span>
                    <span className="hidden shrink-0 text-xs text-[var(--muted)] sm:inline">{product.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {loadError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>}

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {query && (
              <span className="chip">
                Suche: {query}
                <button type="button" onClick={() => setQuery("")} aria-label="Suche entfernen" className="ml-1 hover:text-[var(--fg)]">
                  x
                </button>
              </span>
            )}
            {selectedCategory !== "All" && (
              <span className="chip">
                {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory("All")} aria-label="Kategorie entfernen" className="ml-1 hover:text-[var(--fg)]">
                  x
                </button>
              </span>
            )}
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="stagger-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 3} />
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="panel-soft rounded-xl p-6 text-center text-sm text-[var(--muted)]">
            Keine Produkte gefunden.
          </div>
        )}
        </div>
      </div>
    </section>
  );
}
