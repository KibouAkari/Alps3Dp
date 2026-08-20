"use client";

// Adds the product to the cart (server-side cart for signed-in users, local
// guest cart otherwise) and jumps straight to checkout in one click.
import { useState } from "react";
import { useRouter } from "next/navigation";

import { addToGuestCart } from "@/lib/guest-cart";
import { parseJsonSafely } from "@/lib/fetch-json";

export function BuyNowButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const response = await fetch("/api/cart/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ productId, quantity: 1 }),
          });

          if (response.status === 401) {
            addToGuestCart(productId, 1);
          } else if (!response.ok) {
            const data = await parseJsonSafely(response);
            throw new Error((data.error as string | undefined) || "Produkt konnte nicht hinzugefügt werden.");
          }

          router.push("/checkout");
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Produkt konnte nicht hinzugefügt werden.");
        } finally {
          setLoading(false);
        }
      }}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
    >
      {loading ? "Wird vorbereitet..." : "Jetzt kaufen"}
    </button>
  );
}