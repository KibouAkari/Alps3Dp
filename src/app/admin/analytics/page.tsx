import Link from "next/link";

import { formatChf } from "@/lib/data";
import { db } from "@/lib/db";

import { AdminGuard } from "@/components/admin-guard";
import { ArrowLeftIcon } from "@/components/icons";

export default async function AdminAnalyticsPage() {
  const paidOrdersRaw = await db.order.findMany({
    where: { status: "PAID" },
    include: { items: { include: { product: true } } },
  });
  const paidOrders = paidOrdersRaw as Array<{
    totalCents: number;
    items: Array<{ productId: string; quantity: number; product: { title: string } }>;
  }>;

  const totalRevenue = paidOrders.reduce((sum: number, order) => sum + order.totalCents, 0);
  const soldUnits = paidOrders.reduce((sum: number, order) => sum + order.items.reduce((s: number, i) => s + i.quantity, 0), 0);

  const productSalesMap = new Map<string, { title: string; sold: number }>();
  for (const order of paidOrders) {
    for (const item of order.items) {
      const current = productSalesMap.get(item.productId) || { title: item.product.title, sold: 0 };
      current.sold += item.quantity;
      productSalesMap.set(item.productId, current);
    }
  }

  const topBySales = Array.from(productSalesMap.values())
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 4);

  const clicksProductsRaw = await db.product.findMany({
    where: { isHidden: false },
    select: { id: true, title: true, clicks: true },
    orderBy: { clicks: "desc" },
    take: 4,
  });
  const clicksProducts = clicksProductsRaw as Array<{ id: string; title: string; clicks: number }>;

  const topByClicks = clicksProducts.map((entry) => ({ title: entry.title, clicks: entry.clicks }));

  const maxSales = Math.max(...topBySales.map((product) => product.sold), 1);
  const maxClicks = Math.max(...topByClicks.map((product: { clicks: number }) => product.clicks), 1);

  return (
    <AdminGuard>
      <div className="space-y-6 fade-in-up">
        <div className="space-y-1">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Zurück zum Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Monitoring & Analytics</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Gesamtumsatz</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatChf(totalRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Verkaufte Einheiten</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{soldUnits}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Produktklicks</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{topByClicks.reduce((s: number, p: { clicks: number }) => s + p.clicks, 0)}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Top Produkte nach Verkäufen</h2>
            <div className="mt-4 space-y-4">
              {topBySales.length === 0 && <p className="text-sm text-slate-500">Noch keine Daten vorhanden.</p>}
              {topBySales.map((product) => (
                <div key={product.title} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-slate-900">{product.title}</p>
                    <p className="text-sm text-slate-500">{product.sold}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-700"
                      style={{ width: `${(product.sold / maxSales) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Top Produkte nach Klicks</h2>
            <div className="mt-4 space-y-4">
              {topByClicks.length === 0 && <p className="text-sm text-slate-500">Noch keine Daten vorhanden.</p>}
              {topByClicks.map((product: { title: string; clicks: number }) => (
                <div key={product.title} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-slate-900">{product.title}</p>
                    <p className="text-sm text-slate-500">{product.clicks}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${(product.clicks / maxClicks) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminGuard>
  );
}
