"use client";

// Admin dashboard widget: surfaces Stripe configuration status and lets
// admins trigger safe test/reset utilities backed by /api/admin/ops.
import { useState } from "react";

import { parseJsonSafely } from "@/lib/fetch-json";

type StripeOverview = {
  configured: boolean;
  dashboardUrl: string;
  message?: string;
  publishableKeyConfigured?: boolean;
  webhookSecretConfigured?: boolean;
  mode?: "live" | "test";
  account?: {
    id: string;
    country: string | null;
    defaultCurrency: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  };
  paymentSummary?: {
    pendingOrders: number;
    paidOrders: number;
    latestPaidAt: string | null;
  };
  webhookStatus?: {
    expectedUrl: string;
    requestHostUrl: string | null;
    appUrlMismatch: boolean;
    registeredUrls: string[];
    registered: boolean;
    enabled: boolean;
    missingEvents: string[];
    otherEndpointsCount: number;
  };
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
  const [isRunningMailTest, setIsRunningMailTest] = useState(false);
  const [isRunningStripeTest, setIsRunningStripeTest] = useState(false);

  const runTestOrder = async () => {
    setStatus(null);
    setError(null);
    setIsRunningMailTest(true);
    const response = await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "simulate-order-and-email",
        email: email || undefined,
      }),
    });
    const data = await parseJsonSafely(response);
    setIsRunningMailTest(false);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Test konnte nicht ausgeführt werden.");
      return;
    }
    setStatus(`Test erfolgreich: ${data.orderId}`);
  };

  const runStripeCheckoutTest = async () => {
    setStatus(null);
    setError(null);
    setIsRunningStripeTest(true);
    const response = await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "simulate-stripe-checkout",
        email: email || undefined,
      }),
    });
    const data = await parseJsonSafely(response);
    setIsRunningStripeTest(false);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Stripe-Test konnte nicht gestartet werden.");
      return;
    }
    const checkoutUrl = data.checkoutUrl as string | undefined;
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank", "noreferrer");
    }
    setStatus(
      (data.message as string | undefined) ||
        "Stripe-Testsession erstellt. Schliesse die Zahlung im neuen Tab ab, um den Webhook zu prüfen.",
    );
  };

  const resetDashboardData = async () => {
    const confirmation = window.prompt("Zur Bestätigung bitte RESET eingeben:", "");
    if (confirmation !== "RESET") {
      setError("Reset abgebrochen. Die Bestätigung war nicht korrekt.");
      return;
    }

    setStatus(null);
    setError(null);
    const response = await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "reset-dashboard-data",
        confirmation,
      }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Reset konnte nicht ausgeführt werden.");
      return;
    }
    setStatus(
      `Reset abgeschlossen: ${data.deletedOrders || 0} Bestellungen gelöscht, ${data.resetProductClicks || 0} Produkt-Klickzähler zurückgesetzt.`,
    );
    await loadStripe();
  };

  const loadStripe = async () => {
    setLoadingStripe(true);
    setError(null);
    const response = await fetch("/api/admin/stripe/overview", { credentials: "include", cache: "no-store" });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      setError((data.error as string | undefined) || "Stripe-Übersicht konnte nicht geladen werden.");
      setLoadingStripe(false);
      return;
    }
    setStripe(data as StripeOverview);
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
          <h3 className="text-sm font-semibold text-slate-900">Bestellung + Mail testen</h3>
          <p className="mt-1 text-xs text-slate-600">Erstellt direkt eine bezahlte Testbestellung (ohne Stripe) und löst Kunden-/Admin-Mails aus.</p>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Optional: test@alps3dp.ch"
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <div className="mt-3 flex flex-col gap-3">
            <button
              type="button"
              onClick={runTestOrder}
              disabled={isRunningMailTest}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningMailTest ? "Wird ausgeführt…" : "Mail-Test ausführen"}
            </button>
            <button
              type="button"
              onClick={runStripeCheckoutTest}
              disabled={isRunningStripeTest}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningStripeTest ? "Wird gestartet…" : "Echte Stripe-Testzahlung starten"}
            </button>
            <button
              type="button"
              onClick={resetDashboardData}
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Dashboard-Daten zurücksetzen
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Stripe Verwaltung</h3>
          <p className="mt-1 text-xs text-slate-600">Session-Status prüfen und direkt ins Stripe Dashboard springen.</p>
          {loadingStripe && <p className="mt-3 text-xs text-slate-500">Lädt...</p>}
          {!loadingStripe && stripe && (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>{stripe.configured ? "Stripe konfiguriert" : "Stripe noch nicht konfiguriert"}</p>
              <p>Publishable Key: {stripe.publishableKeyConfigured ? "gesetzt" : "fehlt"}</p>
              <p>Webhook Secret: {stripe.webhookSecretConfigured ? "gesetzt" : "fehlt"}</p>
              {stripe.mode && <p>Modus: {stripe.mode.toUpperCase()}</p>}
              {stripe.account && (
                <p>
                  Account {stripe.account.id.slice(0, 10)} · {stripe.account.country || "-"} · {stripe.account.defaultCurrency?.toUpperCase() || "-"}
                </p>
              )}
              {stripe.paymentSummary && (
                <p>
                  DB Zahlungen: {stripe.paymentSummary.paidOrders} bezahlt / {stripe.paymentSummary.pendingOrders} offen
                </p>
              )}
              {stripe.webhookStatus && (
                <div className={`rounded-lg border p-2 ${stripe.webhookStatus.registered && stripe.webhookStatus.enabled && stripe.webhookStatus.missingEvents.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                  <p className="font-semibold">
                    Webhook: {stripe.webhookStatus.registered ? (stripe.webhookStatus.enabled ? "aktiv" : "registriert, aber deaktiviert") : "nicht registriert"}
                  </p>
                  <p className="mt-0.5 break-all">Erwartete URL: {stripe.webhookStatus.expectedUrl}</p>
                  {stripe.webhookStatus.missingEvents.length > 0 && (
                    <p className="mt-0.5">Fehlende Events: {stripe.webhookStatus.missingEvents.join(", ")}</p>
                  )}
                  {stripe.webhookStatus.appUrlMismatch && (
                    <p className="mt-1 rounded bg-white/60 p-1.5 text-[11px] leading-snug">
                      Hinweis: APP_URL/NEXT_PUBLIC_APP_URL zeigt auf eine andere Domain als die, über die du das Admin-Panel geraden aufrufst ({stripe.webhookStatus.requestHostUrl}). Bitte in den Vercel-Projekteinstellungen auf die echte Produktions-Domain korrigieren.
                    </p>
                  )}
                  {stripe.webhookStatus.registeredUrls.length > 0 && (
                    <p className="mt-1 break-all text-[11px] text-slate-500">Registrierte Webhook-URL(s) bei Stripe: {stripe.webhookStatus.registeredUrls.join(", ")}</p>
                  )}
                </div>
              )}
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
