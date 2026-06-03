"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatChf } from "@/lib/data";

type CartRow = {
  productId: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    priceCents: number;
    salePriceCents?: number | null;
  };
};

export default function CartPage() {
  const [rows, setRows] = useState<CartRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadCart = async () => {
    const response = await fetch("/api/cart", { credentials: "include" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Warenkorb konnte nicht geladen werden.");
    }
    setRows(data.items || []);
  };

  useEffect(() => {
    loadCart().catch((err) => setError(err instanceof Error ? err.message : "Warenkorb konnte nicht geladen werden."));
  }, []);

  const subtotal = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + ((row.product.salePriceCents ?? row.product.priceCents) * row.quantity),
        0,
      ),
    [rows],
  );

  return (
    <div className="space-y-6 fade-in-up">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Warenkorb</h1>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {rows.length === 0 && <p className="text-sm text-slate-500">Dein Warenkorb ist leer.</p>}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.productId} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{row.product.title}</p>
                <p className="text-sm text-slate-500">Menge: {row.quantity}</p>
              </div>
              <p className="font-semibold text-slate-900">{formatChf((row.product.salePriceCents ?? row.product.priceCents) * row.quantity)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/cart/items/${row.productId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ quantity: Math.max(1, row.quantity - 1) }),
                  });
                  await loadCart();
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/cart/items/${row.productId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ quantity: row.quantity + 1 }),
                  });
                  await loadCart();
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                +
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/cart/items/${row.productId}`, {
                    method: "DELETE",
                    credentials: "include",
                  });
                  await loadCart();
                }}
                className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600"
              >
                Entfernen
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-slate-600">Subtotal</p>
        <p className="text-xl font-bold text-slate-900">{formatChf(subtotal)}</p>
      </div>
      <Link href="/checkout" className="inline-block rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700">
        Weiter zum Checkout
      </Link>
    </div>
  );
}
