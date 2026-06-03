"use client";

import { useEffect, useMemo, useState } from "react";

import { formatChf } from "@/lib/data";

type CartRow = {
  productId: string;
  quantity: number;
  product: {
    title: string;
    priceCents: number;
    salePriceCents?: number | null;
  };
};

export default function CheckoutPage() {
  const [rows, setRows] = useState<CartRow[]>([]);
  const [shippingCents, setShippingCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "TWINT">("CARD");

  useEffect(() => {
    fetch("/api/cart", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Warenkorb konnte nicht geladen werden.");
        }
        setRows(data.items || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Warenkorb konnte nicht geladen werden."));

    fetch("/api/settings/shipping", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setShippingCents(data.shippingCents || 0);
        }
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
        <p className="mt-2 text-sm text-slate-600">Kreditkarte und TWINT laufen ueber Stripe (falls konfiguriert).</p>
        {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <form
          className="mt-5 grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setStatus(null);
            setError(null);

            const response = await fetch("/api/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                firstName,
                lastName,
                email,
                address1,
                zip,
                city,
                country: "CH",
                paymentMethod,
              }),
            });

            const data = await response.json();
            if (!response.ok) {
              setError(data.error || "Checkout fehlgeschlagen.");
              return;
            }

            if (data.checkoutUrl) {
              window.location.href = data.checkoutUrl;
              return;
            }

            setStatus("Bestellung erfolgreich gespeichert.");
          }}
        >
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Vorname" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nachname" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="Adresse" className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="PLZ" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ort" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "CARD" | "TWINT")}
            className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            <option value="CARD">Bankkarte (Stripe)</option>
            <option value="TWINT">TWINT (Stripe)</option>
          </select>
          <button type="submit" className="sm:col-span-2 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700">
            Zahlung starten
          </button>
        </form>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Bestelluebersicht</h2>
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
