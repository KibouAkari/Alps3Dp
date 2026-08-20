"use client";

// Cart page: shows the server-backed cart for signed-in users or the
// localStorage guest cart otherwise, with inline quantity/removal controls.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SafeImage } from "@/components/safe-image";
import { formatChf } from "@/lib/data";
import { parseJsonSafely } from "@/lib/fetch-json";
import { getGuestCart, GUEST_CART_STORAGE_KEY, type GuestCartItem } from "@/lib/guest-cart";

type CartRow = {
  productId: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    priceCents: number;
    salePriceCents?: number | null;
    images?: string[];
  };
};

export default function CartPage() {
  const [rows, setRows] = useState<CartRow[]>([]);
  const [isGuest, setIsGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCart = async () => {
    // Fire both requests at once instead of waiting for the session check
    // before starting the cart fetch — /api/cart already returns an empty
    // list for guests, so this is safe and cuts the round trip in half for
    // the common signed-in case.
    const [sessionResponse, cartResponse] = await Promise.all([
      fetch("/api/auth/session", { credentials: "include", cache: "no-store" }),
      fetch("/api/cart", { credentials: "include" }),
    ]);
    const sessionData = await parseJsonSafely(sessionResponse);
    const signedIn = Boolean(sessionData.user);

    if (!signedIn) {
      const guestItems = getGuestCart();
      if (guestItems.length === 0) {
        setIsGuest(true);
        setRows([]);
        window.dispatchEvent(new Event("cart:updated"));
        return;
      }

      const productsResponse = await fetch(`/api/products?ids=${guestItems.map((item) => item.productId).join(",")}`);
      const productsData = await parseJsonSafely(productsResponse);
      const allProducts: CartRow["product"][] = (productsData.products as CartRow["product"][] | undefined) || [];

      const resolved: CartRow[] = guestItems
        .map((item: GuestCartItem) => {
          const product = allProducts.find((p) => p.id === item.productId);
          if (!product) return null;
          return { productId: item.productId, quantity: item.quantity, product };
        })
        .filter((row): row is CartRow => row !== null);

      setIsGuest(true);
      setRows(resolved);
      window.dispatchEvent(new Event("cart:updated"));
      return;
    }

    const data = await parseJsonSafely(cartResponse);
    if (!cartResponse.ok) {
      throw new Error((data.error as string | undefined) || "Warenkorb konnte nicht geladen werden.");
    }

    setIsGuest(false);
    setRows((data.items as CartRow[] | undefined) || []);
    window.dispatchEvent(new Event("cart:updated"));
  };

  const updateGuestQuantity = (productId: string, newQty: number) => {
    const items = getGuestCart();
    const updated = items
      .map((item) => (item.productId === productId ? { ...item, quantity: newQty } : item))
      .filter((item) => item.quantity > 0);
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("cart:updated"));
    setRows((prev) =>
      prev
        .map((row) => (row.productId === productId ? { ...row, quantity: newQty } : row))
        .filter((row) => row.quantity > 0),
    );
  };

  const removeGuestItem = (productId: string) => {
    const items = getGuestCart().filter((item) => item.productId !== productId);
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("cart:updated"));
    setRows((prev) => prev.filter((row) => row.productId !== productId));
  };

  useEffect(() => {
    loadCart()
      .catch((err) => setError(err instanceof Error ? err.message : "Warenkorb konnte nicht geladen werden."))
      .finally(() => setIsLoading(false));
  }, []);

  const subtotal = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + ((row.product.salePriceCents ?? row.product.priceCents) * row.quantity),
        0,
      ),
    [rows],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Warenkorb</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Warenkorb</h1>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {rows.length === 0 && <p className="text-sm text-slate-500">Dein Warenkorb ist leer.</p>}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.productId} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <SafeImage src={row.product.images?.[0]} alt={row.product.title} fill className="object-cover" sizes="64px" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{row.product.title}</p>
                  <p className="text-sm text-slate-500">Menge: {row.quantity}</p>
                </div>
              </div>
              <p className="font-semibold text-slate-900">{formatChf((row.product.salePriceCents ?? row.product.priceCents) * row.quantity)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (isGuest) {
                    updateGuestQuantity(row.productId, Math.max(1, row.quantity - 1));
                  } else {
                    await fetch(`/api/cart/items/${row.productId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ quantity: Math.max(1, row.quantity - 1) }),
                    });
                    await loadCart();
                  }
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isGuest) {
                    updateGuestQuantity(row.productId, row.quantity + 1);
                  } else {
                    await fetch(`/api/cart/items/${row.productId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ quantity: row.quantity + 1 }),
                    });
                    await loadCart();
                  }
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                +
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isGuest) {
                    removeGuestItem(row.productId);
                  } else {
                    await fetch(`/api/cart/items/${row.productId}`, {
                      method: "DELETE",
                      credentials: "include",
                    });
                    await loadCart();
                  }
                }}
                className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600"
              >
                Entfernen
              </button>
            </div>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-slate-600">Subtotal</p>
            <p className="text-xl font-bold text-slate-900">{formatChf(subtotal)}</p>
          </div>
          <Link href="/checkout" className="inline-block rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700">
            Weiter zum Checkout
          </Link>
        </>
      )}
    </div>
  );
}
