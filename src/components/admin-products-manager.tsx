"use client";

import { useEffect, useMemo, useState } from "react";

import { SafeImage } from "@/components/safe-image";
import { formatChf, getDisplayPriceCents } from "@/lib/data";
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
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [shippingCents, setShippingCents] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleCount = useMemo(() => products.filter((item) => !item.isHidden).length, [products]);

  async function loadProducts() {
    setError(null);
    const response = await fetch("/api/products?includeHidden=1", { credentials: "include" });
    const data = (await response.json()) as ProductsResponse;

    if (!response.ok) {
      throw new Error("Produkte konnten nicht geladen werden.");
    }

    setProducts(data.products || []);
    setCategoryList((data.categories || []).map((entry) => entry.name));

    if (!form.category && data.categories && data.categories.length > 0) {
      setForm((prev) => ({ ...prev, category: data.categories[0].name }));
    }
  }

  useEffect(() => {
    loadProducts().catch((err) => setError(err instanceof Error ? err.message : "Produkte konnten nicht geladen werden."));

    fetch("/api/settings/shipping", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setShippingCents(data.shippingCents || 0);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const accepted = Array.from(files).filter((file) => file.type.startsWith("image/"));
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload fehlgeschlagen.");
      }

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...(data.urls || [])],
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

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Produkt konnte nicht gespeichert werden.");
      return;
    }

    await loadProducts();
    setMessage(form.id ? "Produkt aktualisiert." : "Produkt erstellt.");
    setForm({ ...defaultForm, category: categoryList[0] || "" });
    setImageUrlInput("");
  };

  const deleteProduct = async (id: string) => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Produkt konnte nicht gelöscht werden.");
      return;
    }

    await loadProducts();
    setMessage("Produkt gelöscht.");
  };

  const saveShipping = async () => {
    const response = await fetch("/api/settings/shipping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ shippingCents }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Lieferkosten konnten nicht gespeichert werden.");
      return;
    }

    setShippingCents(data.shippingCents || 0);
    setMessage("Lieferkosten gespeichert.");
  };

  return (
    <div className="space-y-6 fade-in-up">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Produkte verwalten</h1>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="panel-surface rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Shop-Einstellungen</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr_auto]">
          <label className="text-sm text-slate-600">
            Lieferkosten (CHF)
            <input
              type="number"
              min={0}
              value={shippingCents / 100}
              onChange={(event) => setShippingCents(Math.max(0, Math.round(Number(event.target.value) * 100)))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </label>
          <div className="text-sm text-slate-500">Wird automatisch im Checkout auf jede Bestellung addiert.</div>
          <button
            type="button"
            onClick={saveShipping}
            className="h-fit self-end rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Speichern
          </button>
        </div>
      </section>

      <section className="panel-surface rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{form.id ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
          <span className="theme-pill rounded-full px-3 py-1 text-xs text-slate-600">{visibleCount} sichtbare Produkte</span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-600">
            <span>Titel</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="z.B. Articulated Dragon"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span>Kategorie</span>
            <input
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              list="known-categories"
              placeholder="z.B. Home"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <datalist id="known-categories">
              {categoryList.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span>Preis (CHF)</span>
            <input
              type="number"
              value={form.priceCents / 100}
              min={1}
              onChange={(event) => setForm((prev) => ({ ...prev, priceCents: Number(event.target.value) * 100 }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span>Aktionspreis (optional)</span>
            <input
              type="number"
              value={(form.salePriceCents ?? 0) / 100}
              min={0}
              onChange={(event) => {
                const value = Number(event.target.value);
                setForm((prev) => ({ ...prev, salePriceCents: value > 0 ? value * 100 : undefined }));
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span>Lagerbestand</span>
            <input
              type="number"
              value={form.stock}
              min={0}
              onChange={(event) => setForm((prev) => ({ ...prev, stock: Number(event.target.value) }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isHidden}
              onChange={(event) => setForm((prev) => ({ ...prev, isHidden: event.target.checked }))}
            />
            Produkt verstecken
          </label>

          <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
            <span>Beschreibung</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Kurzbeschreibung"
              className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">Produktbilder</p>
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
                <p className="text-sm font-medium text-slate-800">Bilder per Drag-and-drop hier ablegen</p>
                <p className="text-xs text-slate-500">Mehrere Bilder werden optimiert gespeichert und bleiben schnell ladbar.</p>
              </div>
              <label className="hover-lift inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
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

            {isUploading && <p className="mt-3 text-xs text-sky-700">Bilder werden hochgeladen...</p>}

            <div className="mt-4 flex flex-wrap gap-2">
            {form.images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="group hover-lift relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <SafeImage src={image} alt={`Bild ${index + 1}`} fill className="object-cover" sizes="80px" />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))}
                  className="absolute right-1 top-1 rounded-full bg-white/90 px-1 text-xs text-rose-600 shadow-sm transition hover:bg-white"
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveProduct}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            {form.id ? "Änderungen speichern" : "Produkt speichern"}
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...defaultForm, category: categoryList[0] || "" })}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Zurücksetzen
          </button>
        </div>
      </section>

      <section className="panel-surface overflow-x-auto rounded-2xl shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Produkt</th>
              <th className="px-4 py-3">Preis</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-slate-200 text-slate-700">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-md border border-slate-200">
                      <SafeImage src={product.images[0]} alt={product.title} fill className="object-cover" sizes="40px" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{product.title}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold">{formatChf(getDisplayPriceCents(product))}</span>
                  {product.salePriceCents && <span className="ml-2 text-xs text-slate-400 line-through">{formatChf(product.priceCents)}</span>}
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
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Bearbeiten
                    </button>
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
                          isHidden: !Boolean(product.isHidden),
                        })
                      }
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {product.isHidden ? "Einblenden vorbereiten" : "Verstecken vorbereiten"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProduct(product.id)}
                      className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
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
