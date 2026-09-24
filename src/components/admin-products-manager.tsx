"use client";

// Admin CRUD screen for the product catalog: create, edit, hide, and delete
// products, including image upload and category assignment.
import { useEffect, useMemo, useRef, useState } from "react";

import { SafeImage } from "@/components/safe-image";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
import { parseJsonSafely } from "@/lib/fetch-json";
import type { Product } from "@/lib/types";

type ProductForm = {
  id?: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  images: string[];
  isHidden: boolean;
};

const defaultForm: ProductForm = {
  title: "",
  description: "",
  category: "",
  priceCents: 2900,
  salePriceCents: undefined,
  stock: 0,
  images: [],
  isHidden: false,
};

type ProductsResponse = {
  products: Product[];
  categories: Array<{ id: string; name: string; slug: string }>;
};

export function AdminProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  const [categoryBusyId, setCategoryBusyId] = useState<string | null>(null);
  const categoryList = useMemo(() => categories.map((entry) => entry.name), [categories]);
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [shippingCents, setShippingCents] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  // Actions taken far down the page (e.g. deleting a row in the product
  // table) otherwise leave the result banner off-screen above the fold,
  // which looks like nothing happened.
  useEffect(() => {
    if (message || error) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [message, error]);

  const visibleCount = useMemo(() => products.filter((item) => !item.isHidden).length, [products]);

  async function loadProducts() {
    setError(null);
    const response = await fetch("/api/products?includeHidden=1", { credentials: "include" });
    const data = await parseJsonSafely(response) as Partial<ProductsResponse>;

    if (!response.ok) {
      throw new Error("Produkte konnten nicht geladen werden.");
    }

    setProducts(data.products || []);
    setCategories(data.categories || []);

    const fetchedCategories = data.categories;
    if (!form.category && fetchedCategories && fetchedCategories.length > 0) {
      setForm((prev) => ({ ...prev, category: fetchedCategories[0].name }));
    }
  }

  useEffect(() => {
    loadProducts().catch((err) => setError(err instanceof Error ? err.message : "Produkte konnten nicht geladen werden."));

    fetch("/api/settings/shipping", { credentials: "include" })
      .then(async (response) => {
        const data = await parseJsonSafely(response);
        if (response.ok) {
          setShippingCents((data.shippingCents as number | undefined) || 0);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) {
      return;
    }

    // Drag-and-drop (unlike the file picker) doesn't always populate
    // File.type on Windows, so also accept by extension; the server
    // re-validates the actual bytes regardless (see /api/uploads).
    const accepted = Array.from(files).filter(
      (file) => file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(file.name),
    );
    if (accepted.length === 0) {
      setError("Bitte nur Bilddateien hochladen.");
      return;
    }

    const payload = new FormData();
    accepted.forEach((file) => payload.append("files", file));

    setIsUploading(true);
    setError(null);
    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        credentials: "include",
        body: payload,
      });

      const data = await parseJsonSafely(response);
      if (!response.ok) {
        throw new Error((data.error as string | undefined) || "Upload fehlgeschlagen.");
      }

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...((data.urls as string[] | undefined) || [])],
      }));
      setMessage(`${accepted.length} Bild(er) hochgeladen.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const saveProduct = async () => {
    setError(null);
    setMessage(null);

    if (!form.title.trim() || !form.description.trim() || form.images.length === 0) {
      setError("Bitte Titel, Beschreibung und mindestens ein Bild erfassen.");
      return;
    }

    const payload = {
      title: form.title,
      description: form.description,
      category: form.category || undefined,
      priceCents: form.priceCents,
      salePriceCents: form.salePriceCents,
      stock: form.stock,
      images: form.images,
      isHidden: form.isHidden,
    };

    const response = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Produkt konnte nicht gespeichert werden.");
      return;
    }

    await loadProducts();
    setMessage(form.id ? "Produkt aktualisiert." : "Produkt erstellt.");
    setForm({ ...defaultForm, category: categoryList[0] || "" });
    setImageUrlInput("");
  };

  // Immediately flips visibility without going through the edit form, since
  // admins expect this to be a one-click toggle.
  const toggleHidden = async (product: Product) => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: product.title,
        description: product.description,
        category: product.category,
        priceCents: product.priceCents,
        salePriceCents: product.salePriceCents,
        stock: product.stock,
        images: product.images,
        isHidden: !product.isHidden,
      }),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Sichtbarkeit konnte nicht geändert werden.");
      return;
    }

    await loadProducts();
    setMessage(product.isHidden ? "Produkt ist wieder sichtbar." : "Produkt ist jetzt versteckt.");
  };

  const deleteProduct = async (id: string) => {
    setError(null);
    setMessage(null);

    if (!window.confirm("Dieses Produkt wirklich löschen?")) {
      return;
    }

    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Produkt konnte nicht gelöscht werden.");
      return;
    }

    await loadProducts();
    setMessage(
      data.archived
        ? "Produkt entfernt. Da es bereits bestellt wurde, bleibt es für die Bestellhistorie im Hintergrund erhalten."
        : "Produkt gelöscht.",
    );
  };

  const renameCategory = async (id: string) => {
    const name = (categoryEdits[id] ?? categories.find((c) => c.id === id)?.name ?? "").trim();
    if (!name) {
      setError("Bitte einen Kategorienamen angeben.");
      return;
    }

    setError(null);
    setMessage(null);
    setCategoryBusyId(id);
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) {
        setError((data.error as string | undefined) || "Kategorie konnte nicht gespeichert werden.");
        return;
      }
      await loadProducts();
      setMessage("Kategorie umbenannt.");
    } finally {
      setCategoryBusyId(null);
    }
  };

  // Deletes the category outright; affected products keep existing but lose
  // their category (schema.prisma sets categoryId to null), they are not deleted.
  const deleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Kategorie "${name}" wirklich löschen? Zugehörige Produkte verlieren nur die Kategoriezuordnung.`)) {
      return;
    }

    setError(null);
    setMessage(null);
    setCategoryBusyId(id);
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) {
        setError((data.error as string | undefined) || "Kategorie konnte nicht gelöscht werden.");
        return;
      }
      await loadProducts();
      setMessage("Kategorie gelöscht.");
    } finally {
      setCategoryBusyId(null);
    }
  };

  const saveShipping = async () => {
    const response = await fetch("/api/settings/shipping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ shippingCents }),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Lieferkosten konnten nicht gespeichert werden.");
      return;
    }

    setShippingCents((data.shippingCents as number | undefined) || 0);
    setMessage("Lieferkosten gespeichert.");
  };

  return (
    <div className="space-y-6 fade-in-up">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--fg)]">Produkte verwalten</h1>

      {message && <p ref={feedbackRef} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p ref={feedbackRef} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="panel-surface rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--fg)]">Shop-Einstellungen</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr_auto]">
          <label className="text-sm text-[var(--muted)]">
            Lieferkosten (CHF)
            <input
              type="number"
              min={0}
              value={shippingCents / 100}
              onChange={(event) => setShippingCents(Math.max(0, Math.round(Number(event.target.value) * 100)))}
              className="field-input mt-1"
            />
          </label>
          <div className="text-sm text-[var(--muted)]">Wird automatisch im Checkout auf jede Bestellung addiert.</div>
          <button
            type="button"
            onClick={saveShipping}
            className="press h-fit self-end rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            Speichern
          </button>
        </div>
      </section>

      <section className="panel-surface rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--fg)]">Kategorien verwalten</h2>
          <span className="chip">{categories.length} Kategorien</span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Umbenennen wirkt sich sofort auf alle zugehörigen Produkte aus. Löschen entfernt nur die Kategorie – betroffene Produkte bleiben erhalten und verlieren lediglich die Zuordnung.
        </p>

        <div className="mt-4 space-y-1">
          {categories.map((category) => {
            const busy = categoryBusyId === category.id;
            return (
              <div key={category.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--surface-border)] py-2 last:border-0">
                <input
                  value={categoryEdits[category.id] ?? category.name}
                  onChange={(event) => setCategoryEdits((prev) => ({ ...prev, [category.id]: event.target.value }))}
                  className="field-input flex-1"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void renameCategory(category.id)}
                  className="btn-outline press rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteCategory(category.id, category.name)}
                  className="btn-danger-outline press rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Löschen
                </button>
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Noch keine Kategorien vorhanden. Sie werden beim Anlegen eines Produkts automatisch erstellt.</p>
          )}
        </div>
      </section>

      <section className="panel-surface rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--fg)]">{form.id ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
          <span className="chip">{visibleCount} sichtbare Produkte</span>
        </div>

        <div className="mt-5 space-y-5">
          <div className="field-box p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--fg)]">1. Produktbilder</p>
            <div
              className={`upload-zone rounded-xl p-4 transition ${isDraggingFiles ? "upload-zone-active" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={async (event) => {
                event.preventDefault();
                setIsDraggingFiles(false);
                await addFiles(event.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--fg)]">Bilder per Drag-and-drop hier ablegen</p>
                  <p className="text-xs text-[var(--muted)]">Mehrere Bilder werden optimiert gespeichert und bleiben schnell ladbar.</p>
                </div>
                <label className="btn-outline hover-lift press inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm">
                  Bilddateien auswählen
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (event) => {
                      await addFiles(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

            {isUploading && <p className="mt-3 text-xs text-[var(--muted)]">Bilder werden hochgeladen...</p>}

            <div className="mt-4 flex flex-wrap gap-2">
            {form.images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="group hover-lift relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm"
              >
                <SafeImage src={image} alt={`Bild ${index + 1}`} fill className="object-cover" sizes="80px" />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))}
                  className="absolute right-1 top-1 rounded-full bg-[var(--bg-soft)]/90 px-1 text-xs text-rose-600 shadow-sm transition hover:bg-[var(--bg-soft)]"
                >
                  x
                </button>
              </div>
            ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={imageUrlInput}
                onChange={(event) => setImageUrlInput(event.target.value)}
                placeholder="Bild-URL einfügen (optional)"
                className="field-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (!imageUrlInput.trim()) {
                    return;
                  }
                  setForm((prev) => ({ ...prev, images: [...prev.images, imageUrlInput.trim()] }));
                  setImageUrlInput("");
                }}
                className="btn-outline press rounded-lg px-3 py-2 text-sm"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>

        <div className="field-box p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--fg)]">2. Basisdaten</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[var(--muted)]">
              <span>Titel</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="z.B. Articulated Dragon"
                className="field-input"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--muted)]">
              <span>Kategorie</span>
              <input
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                list="known-categories"
                placeholder="z.B. Home"
                className="field-input"
              />
              <datalist id="known-categories">
                {categoryList.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>

            <label className="space-y-1 text-sm text-[var(--muted)] sm:col-span-2">
              <span>Beschreibung</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Kurzbeschreibung"
                className="field-input min-h-24"
              />
            </label>
          </div>
        </div>

        <div className="field-box p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--fg)]">3. Preis, Lager & Sichtbarkeit</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[var(--muted)]">
              <span>Preis (CHF)</span>
              <input
                type="number"
                value={form.priceCents / 100}
                min={1}
                onChange={(event) => setForm((prev) => ({ ...prev, priceCents: Number(event.target.value) * 100 }))}
                className="field-input"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--muted)]">
              <span>Aktionspreis (optional)</span>
              <input
                type="number"
                value={(form.salePriceCents ?? 0) / 100}
                min={0}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setForm((prev) => ({ ...prev, salePriceCents: value > 0 ? value * 100 : undefined }));
                }}
                className="field-input"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--muted)]">
              <span>Lagerbestand</span>
              <input
                type="number"
                value={form.stock}
                min={0}
                onChange={(event) => setForm((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                className="field-input"
              />
            </label>

            <label className="field-box flex items-center gap-2 px-3 py-2 text-sm text-[var(--fg)]">
              <input
                type="checkbox"
                checked={form.isHidden}
                onChange={(event) => setForm((prev) => ({ ...prev, isHidden: event.target.checked }))}
              />
              Produkt verstecken
            </label>
          </div>
        </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveProduct}
            className="press rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            {form.id ? "Änderungen speichern" : "Produkt speichern"}
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...defaultForm, category: categoryList[0] || "" })}
            className="btn-outline press rounded-lg px-4 py-2 text-sm"
          >
            Zurücksetzen
          </button>
        </div>
      </section>

      <section className="panel-surface overflow-x-auto rounded-2xl shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Produkt</th>
              <th className="px-4 py-3">Preis</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-[var(--surface-border)] text-[var(--muted)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-md border border-[var(--surface-border)]">
                      <SafeImage src={product.images[0]} alt={product.title} fill className="object-cover" sizes="40px" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--fg)]">{product.title}</p>
                      <p className="text-xs text-[var(--muted)]">{product.category}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-[var(--fg)]">{formatChf(getDisplayPriceCents(product))}</span>
                  {product.salePriceCents && <span className="ml-2 text-xs text-[var(--muted)] line-through">{formatChf(product.priceCents)}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${product.isHidden ? "status-pill-hidden" : "status-pill-visible"}`}>
                    {product.isHidden ? "Versteckt" : "Sichtbar"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          id: product.id,
                          title: product.title,
                          description: product.description,
                          category: product.category,
                          priceCents: product.priceCents,
                          salePriceCents: product.salePriceCents,
                          stock: product.stock,
                          images: product.images,
                          isHidden: Boolean(product.isHidden),
                        })
                      }
                      className="btn-outline press rounded-md px-2 py-1 text-xs"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleHidden(product)}
                      className="btn-outline press rounded-md px-2 py-1 text-xs"
                    >
                      {product.isHidden ? "Einblenden" : "Verstecken"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProduct(product.id)}
                      className="btn-danger-outline press rounded-md px-2 py-1 text-xs"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  Noch keine Produkte vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
