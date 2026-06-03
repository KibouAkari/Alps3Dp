import { ShopClient } from "@/components/shop-client";

export default function HomePage() {
  return (
    <div className="space-y-8 fade-in-up">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-sky-50 to-white p-6 shadow-sm sm:p-10">
        <p className="text-sm uppercase tracking-[0.2em] text-sky-700">3D Print Shop</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Handgefertigte 3D-gedruckte Produkte aus der Schweiz
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Jedes Produkt wird auf Bestellung gedruckt – individuell, langlebig und direkt zu dir geliefert.
        </p>
      </section>
      <ShopClient />
    </div>
  );
}
