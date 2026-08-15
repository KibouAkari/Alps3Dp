"use client";

import Link from "next/link";
import { useEffect } from "react";

import { clearGuestCart } from "@/lib/guest-cart";

type PaymentResultProps = {
  variant: "success" | "failed";
};

export function PaymentResult({ variant }: PaymentResultProps) {
  const isSuccess = variant === "success";

  useEffect(() => {
    if (isSuccess) {
      clearGuestCart();
    }
  }, [isSuccess]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-3xl items-center justify-center py-10">
      <section className={`payment-result ${isSuccess ? "payment-result-success" : "payment-result-failed"}`}>
        <div className="payment-result-mark" aria-hidden="true">
          {isSuccess ? <span className="payment-check">✓</span> : <span className="payment-cross">×</span>}
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Alps3Dp Bestellung
        </p>
        <h1 className="payment-result-title mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {isSuccess ? "Zahlung erfolgreich" : "Zahlung nicht abgeschlossen"}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-600">
          {isSuccess
            ? "Danke für deine Bestellung. Wir haben die Zahlung erhalten und senden dir die Bestätigung per E-Mail."
            : "Die Zahlung wurde abgebrochen oder konnte nicht abgeschlossen werden. Deine Bestellung ist noch nicht bezahlt."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isSuccess ? (
            <Link href="/" className="rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">
              Weiter einkaufen
            </Link>
          ) : (
            <Link href="/checkout" className="rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">
              Erneut versuchen
            </Link>
          )}
          <Link href={isSuccess ? "/account" : "/cart"} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {isSuccess ? "Zum Konto" : "Warenkorb prüfen"}
          </Link>
        </div>
        <p className="mt-8 text-xs text-slate-400">Bei Fragen hilft dir unser Support gerne weiter.</p>
      </section>
    </main>
  );
}
