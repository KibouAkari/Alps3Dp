"use client";

// Checkout form: works for both signed-in customers (server cart, saved
// addresses/payment methods) and anonymous guests (cart from localStorage).
// On submit it posts to /api/checkout, which either confirms an invoice-free
// order or returns a Stripe Checkout URL to redirect to.
import { useEffect, useMemo, useState } from "react";

import { formatChf } from "@/lib/data";
import { parseJsonSafely } from "@/lib/fetch-json";
import { getGuestCart, clearGuestCart, GUEST_CART_STORAGE_KEY, type GuestCartItem } from "@/lib/guest-cart";

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

type SavedAddress = {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  zipCode: string;
  city: string;
  isDefault: boolean;
};

type SavedPaymentMethod = {
  id: string;
  type: "card" | "twint";
  last4: string | null;
  isDefault: boolean;
};

export default function CheckoutPage() {
  const [rows, setRows] = useState<CartRow[]>([]);
  const [shippingCents, setShippingCents] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [saveMethod, setSaveMethod] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "TWINT">("CARD");

  useEffect(() => {
    fetch("/api/settings/shipping", { credentials: "include" })
      .then(async (r) => {
        const d = await parseJsonSafely(r);
        if (r.ok) setShippingCents((d.shippingCents as number | undefined) || 0);
      })
      .catch(() => undefined);

    // Try to load logged-in account data
    fetch("/api/account", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          // Not logged in - load guest cart from localStorage
          setIsGuest(true);
          const guestItems = getGuestCart();
          if (guestItems.length > 0) {
            const productsResponse = await fetch(`/api/products?ids=${guestItems.map((item) => item.productId).join(",")}`);
            const productsData = await parseJsonSafely(productsResponse);
            const allProducts: CartRow["product"][] = (productsData.products as CartRow["product"][] | undefined) || [];
            const resolved: CartRow[] = guestItems
              .map((item: GuestCartItem) => {
                const product = allProducts.find((p) => p.id === item.productId);
                if (!product) return null;
                return { productId: item.productId, quantity: item.quantity, product };
              })
              .filter((row: CartRow | null): row is CartRow => row !== null);
            setRows(resolved);
          }
          return;
        }

        const data = await parseJsonSafely(response);
        const profile = data.profile as { addresses?: SavedAddress[]; paymentMethods?: SavedPaymentMethod[]; email?: string } | undefined;
        const addresses = profile?.addresses || [];
        const methods = profile?.paymentMethods || [];
        setSavedAddresses(addresses);
        setSavedMethods(methods);

        const defaultAddress = addresses.find((entry: SavedAddress) => entry.isDefault);
        const defaultMethod = methods.find((entry: SavedPaymentMethod) => entry.isDefault);

        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          setFirstName(defaultAddress.firstName || "");
          setLastName(defaultAddress.lastName || "");
          setAddress1(defaultAddress.street || "");
          setZip(defaultAddress.zipCode || "");
          setCity(defaultAddress.city || "");
        }
        if (defaultMethod) {
          setSelectedMethodId(defaultMethod.id);
          setPaymentMethod(
            defaultMethod.type === "twint" ? "TWINT" : "CARD",
          );
        }
        if (profile?.email) {
          setEmail(profile.email);
        }

        // Load DB cart for logged-in user
        const cartResponse = await fetch("/api/cart", { credentials: "include" });
        const cartData = await parseJsonSafely(cartResponse);
        setRows((cartData.items as CartRow[] | undefined) || []);
      })
      .catch(() => undefined);
  }, []);

  const subtotalCents = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const price = row.product.salePriceCents ?? row.product.priceCents;
        return sum + price * row.quantity;
      }, 0),
    [rows],
  );

  const totalCents = subtotalCents + shippingCents;

  const reduceQuantity = async (row: CartRow) => {
    if (isGuest) {
      const items = getGuestCart()
        .map((item) => item.productId === row.productId ? { ...item, quantity: item.quantity - 1 } : item)
        .filter((item) => item.quantity > 0);
      localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
      setRows((current) => current
        .map((item) => item.productId === row.productId ? { ...item, quantity: item.quantity - 1 } : item)
        .filter((item) => item.quantity > 0));
      window.dispatchEvent(new Event("cart:updated"));
      return;
    }

    await fetch(`/api/cart/items/${row.productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quantity: row.quantity - 1 }),
    });
    const response = await fetch("/api/cart", { credentials: "include", cache: "no-store" });
    const data = await parseJsonSafely(response);
    setRows((data.items as CartRow[] | undefined) || []);
    window.dispatchEvent(new Event("cart:updated"));
  };

  return (
    <div className="grid gap-6 fade-in-up lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
        <p className="mt-2 text-sm text-slate-600">Sichere Zahlung mit Kreditkarte oder TWINT.</p>
        {isGuest && (
          <p className="mt-2 text-xs text-slate-500">
            Du bestellst als Gast. <a href="/auth/login" className="text-sky-600 hover:underline">Einloggen</a> für Bestellhistorie & gespeicherte Adressen.
          </p>
        )}
        {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <form
          className="mt-5 grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (isSubmitting) return;
            setIsSubmitting(true);
            setStatus(null);
            setError(null);

            try {
              const payload: Record<string, unknown> = {
                addressId: selectedAddressId || undefined,
                savedPaymentMethodId: selectedMethodId || undefined,
                firstName,
                lastName,
                email,
                address1,
                zip,
                city,
                country: "CH",
                paymentMethod,
              };

              if (isGuest) {
                payload.guestItems = getGuestCart();
              }

              const response = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
              });

              const data = await parseJsonSafely(response);
              if (!response.ok) {
                setError((data.error as string | undefined) || "Checkout fehlgeschlagen.");
                return;
              }

            if (data.checkoutUrl) {
              if (!isGuest) {
                if (saveAddress && !selectedAddressId) {
                  await fetch("/api/account/addresses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      firstName,
                      lastName,
                      street: address1,
                      zipCode: zip,
                      city,
                      country: "CH",
                      isDefault: savedAddresses.length === 0,
                    }),
                  });
                }
                if (saveMethod && !selectedMethodId) {
                  await fetch("/api/account/payment-methods", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      type: paymentMethod === "TWINT" ? "twint" : "card",
                      isDefault: savedMethods.length === 0,
                    }),
                  });
                }
              }
              if (isGuest) clearGuestCart();
              window.location.href = data.checkoutUrl as string;
              return;
            }

              if (isGuest) clearGuestCart();
              setStatus("Bestellung erfolgreich gespeichert.");
            } catch {
              setError("Checkout konnte nicht gestartet werden. Bitte versuche es erneut.");
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {savedAddresses.length > 0 && (
            <select
              value={selectedAddressId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedAddressId(id);
                if (!id) return;
                const address = savedAddresses.find((entry) => entry.id === id);
                if (!address) return;
                setFirstName(address.firstName || "");
                setLastName(address.lastName || "");
                setAddress1(address.street || "");
                setZip(address.zipCode || "");
                setCity(address.city || "");
              }}
              className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Neue Adresse eingeben</option>
              {savedAddresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.firstName} {address.lastName}, {address.street}, {address.zipCode} {address.city}
                </option>
              ))}
            </select>
          )}
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Vorname" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nachname" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="Adresse" className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="PLZ" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ort" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          {!isGuest && (
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
              Adresse für nächste Bestellung speichern
            </label>
          )}

          {savedMethods.length > 0 && (
            <select
              value={selectedMethodId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedMethodId(id);
                if (!id) return;
                const method = savedMethods.find((entry) => entry.id === id);
                if (!method) return;
                setPaymentMethod(
                  method.type === "twint" ? "TWINT" : "CARD",
                );
              }}
              className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Neue Zahlungsart verwenden</option>
              {savedMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.type === "twint" ? "TWINT" : "Kreditkarte"}
                  {method.last4 ? ` ****${method.last4}` : ""}
                </option>
              ))}
            </select>
          )}

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "CARD" | "TWINT")}
            className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            <option value="CARD">Kreditkarte</option>
            <option value="TWINT">TWINT</option>
          </select>
          {!isGuest && (
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={saveMethod} onChange={(e) => setSaveMethod(e.target.checked)} />
              Zahlungsart für nächste Bestellung speichern
            </label>
          )}
          <button type="submit" disabled={isSubmitting} className="checkout-submit-button sm:col-span-2 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-80">
            <span className={isSubmitting ? "checkout-button-label checkout-button-label-loading" : "checkout-button-label"}>
              {isSubmitting ? "Zahlung wird vorbereitet..." : "Bestellung abschliessen"}
            </span>
          </button>
        </form>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Bestellübersicht</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {rows.map((row) => (
            <div key={row.productId} className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => void reduceQuantity(row)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-base leading-none text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                aria-label={`${row.product.title} einmal entfernen`}
                title="Ein Stück entfernen"
              >
                ×
              </button>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-slate-800">{row.product.title}</span>
                <span className="ml-2 text-xs text-slate-500">Menge {row.quantity}</span>
              </span>
              <span className="shrink-0 font-medium text-slate-800">{formatChf((row.product.salePriceCents ?? row.product.priceCents) * row.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span>Zwischensumme</span>
            <span>{formatChf(subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Versand</span>
            <span>{formatChf(shippingCents)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>{formatChf(totalCents)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
