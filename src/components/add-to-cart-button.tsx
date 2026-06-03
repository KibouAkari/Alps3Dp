"use client";

import { useState } from "react";

type AddToCartButtonProps = {
  productId: string;
};

export function AddToCartButton({ productId }: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          try {
            const response = await fetch("/api/cart/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ productId, quantity: 1 }),
            });
            const data = await response.json();
            if (!response.ok) {
              setMessage(data.error || "Konnte nicht in den Warenkorb gelegt werden.");
              return;
            }
            setMessage("Zum Warenkorb hinzugefuegt.");
          } finally {
            setLoading(false);
          }
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
      >
        {loading ? "Bitte warten..." : "In Warenkorb"}
      </button>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}
