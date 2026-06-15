"use client";

import { useState } from "react";

type StripeOverview = {
  configured: boolean;
  dashboardUrl: string;
  message?: string;
  sessions?: Array<{
    id: string;
    created: number;
    amountTotal: number | null;
    currency: string | null;
    paymentStatus: string | null;
    status: string | null;
    customerEmail: string | null;
  }>;
};

export function AdminOpsTools() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<StripeOverview | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);

  const runTestOrder = async () => {
    setStatus(null);
    setError(null);
    const response = await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "simulate-order-and-email",
        email: email || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Test konnte nicht ausgeführt werden.");
      return;
    }
    setStatus(`Test erfolgreich: ${data.orderId}`);
  };

  const loadStripe = async () => {
    setLoadingStripe(true);
    setError(null);
    const response = await fetch("/api/admin/stripe/overview", { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Stripe-Übersicht konnte nicht geladen werden.");
      setLoadingStripe(false);
      return;
    }
    setStripe(data);
    setLoadingStripe(false);
  };

  return (
    <section className="panel-surface rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Test & Stripe Tools</h2>
        <button
          type="button"
          onClick={loadStripe}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
        >
          Stripe aktualisieren
        </button>
      </div>

      {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Kauf simulieren + Mail senden</h3>
          <p className="mt-1 text-xs text-slate-600">Erstellt eine Testbestellung und löst Kunden-/Admin-Mails aus.</p>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Optional: test@alps3dp.ch"
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <button
            type="button"
            onClick={runTestOrder}
            className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Test ausführen
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Stripe Verwaltung</h3>
          <p className="mt-1 text-xs text-slate-600">Session-Status prüfen und direkt ins Stripe Dashboard springen.</p>
          {loadingStripe && <p className="mt-3 text-xs text-slate-500">Lädt...</p>}
          {!loadingStripe && stripe && (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>{stripe.configured ? "Stripe konfiguriert" : "Stripe noch nicht konfiguriert"}</p>
              {stripe.message && <p>{stripe.message}</p>}
              <a href={stripe.dashboardUrl} target="_blank" rel="noreferrer" className="inline-flex text-sky-700 hover:underline">
                Stripe Dashboard öffnen
              </a>
              {stripe.sessions && stripe.sessions.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {stripe.sessions.slice(0, 3).map((entry) => (
                    <li key={entry.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                      {entry.id.slice(0, 10)} · {entry.paymentStatus || entry.status} · {(entry.amountTotal || 0) / 100} {entry.currency?.toUpperCase() || "CHF"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
