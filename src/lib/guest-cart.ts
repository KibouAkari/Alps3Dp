export type GuestCartItem = {
  productId: string;
  quantity: number;
};

const STORAGE_KEY = "alps3dp.guest-cart";

export function getGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GuestCartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.productId === "string" &&
        typeof item.quantity === "number",
    );
  } catch {
    return [];
  }
}

export function addToGuestCart(productId: string, quantity = 1): void {
  const items = getGuestCart();
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, quantity });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart:updated"));
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("cart:updated"));
}
