"use client";

import { useEffect, useMemo, useState } from "react";

import { formatChf } from "@/lib/data";
import { getGuestCart, clearGuestCart, type GuestCartItem } from "@/lib/guest-cart";

type CartRow = {
  productId: string;
  quantity: number;
  product: {
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
  type: "card" | "twint" | "invoice";
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"INVOICE" | "CARD" | "TWINT">("INVOICE");

  useEffect(() => {
    fetch("/api/settings/shipping", { credentials: "include" })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) setShippingCents(d.shippingCents || 0);
      })
      .catch(() => undefined);

    // Try to load logged-in account data
    fetch("/api/account", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          // Not logged in â€“ load guest cart from localStorage
          setIsGuest(true);
          const guestItems = getGuestCart();
          if (guestItems.length > 0) {
            const productsResponse = await fetch("/api/products");
            const productsData = await productsResponse.json();
            const allProducts: CartRow["product"][] = productsData.products || [];
            const resolved: CartRow[] = guestItems
              .map((item: GuestCartItem) => {
                const product = allProducts.find((p: CartRow["product"] & { id: string }) => p.id === item.productId);
                if (!product) return null;
                return { productId: item.productId, quantity: item.quantity, product };
              })
              .filter((row: CartRow | null): row is CartRow => row !== null);
            setRows(resolved);
          }
          return;
        }

        const data = await response.json();
        const addresses = data.profile?.addresses || [];
        const methods = data.profile?.paymentMethods || [];
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
            defaultMethod.type === "twint" ? "TWINT" : defaultMethod.type === "invoice" ? "INVOICE" : "CARD",
          );
        }
        if (data.profile?.email) {
          setEmail(data.profile.email);
        }

        // Load DB cart for logged-in user
        const cartResponse = await fetch("/api/cart", { credentials: "include" });
        const cartData = await cartResponse.json();
        setRows(cartData.items || []);
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

  return (
    <div className="grid gap-6 fade-in-up lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
        <p className="mt-2 text-sm text-slate-600">
          Empfohlen: Rechnung/Vorkasse (kostenlos). Karte und TWINT bleiben optional verfügbar.
        </p>
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
            setStatus(null);
            setError(null);

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

            const data = await response.json();
            if (!response.ok) {
              setError(data.error || "Checkout fehlgeschlagen.");
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
                      type: paymentMethod === "TWINT" ? "twint" : paymentMethod === "INVOICE" ? "invoice" : "card",
                      isDefault: savedMethods.length === 0,
                    }),
                  });
                }
              }
              if (isGuest) clearGuestCart();
              window.location.href = data.checkoutUrl;
              return;
            }

            if (isGuest) clearGuestCart();
            setStatus("Bestellung erfolgreich gespeichert.");
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
                  method.type === "twint" ? "TWINT" : method.type === "invoice" ? "INVOICE" : "CARD",
                );
              }}
              className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Neue Zahlungsart verwenden</option>
              {savedMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.type === "twint" ? "TWINT" : method.type === "invoice" ? "Rechnung/Vorkasse" : "Karte"}
                  {method.last4 ? ` ****${method.last4}` : ""}
                </option>
              ))}
            </select>
          )}

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "INVOICE" | "CARD" | "TWINT")}
            className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            <option value="INVOICE">Rechnung / Vorkasse (kostenlos)</option>
            <option value="CARD">Bankkarte (optional via Stripe)</option>
            <option value="TWINT">TWINT (optional via Stripe)</option>
          </select>
          {!isGuest && (
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={saveMethod} onChange={(e) => setSaveMethod(e.target.checked)} />
              Zahlungsart für nächste Bestellung speichern
            </label>
          )}
          <button type="submit" className="sm:col-span-2 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700">
            Bestellung abschliessen
          </button>
        </form>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Bestellübersicht</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {rows.map((row) => (
            <div key={row.productId} className="flex justify-between">
              <span>
                {row.quantity}x {row.product.title}
              </span>
              <span>{formatChf((row.product.salePriceCents ?? row.product.priceCents) * row.quantity)}</span>
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
