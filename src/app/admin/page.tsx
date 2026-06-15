import Link from "next/link";

import { AdminGuard } from "@/components/admin-guard";
import { AdminOpsTools } from "@/components/admin-ops-tools";
import { formatChf } from "@/lib/data";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  Versendet: "status-pill-visible",
  "In Bearbeitung": "status-pill-hidden",
  Bezahlt: "status-pill-visible",
  PAID: "status-pill-visible",
  PENDING: "status-pill-hidden",
  SHIPPED: "status-pill-visible",
  FAILED: "status-pill-hidden",
  CANCELLED: "status-pill-hidden",
};

export default async function AdminHomePage() {
  const [paid30Days, orderCount, productsCount, latestOrdersRaw] = await Promise.all([
    db.order.aggregate({
      where: {
        status: "PAID",
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _sum: { totalCents: true },
    }),
    db.order.count(),
    db.product.count(),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: {
          include: {
            product: true,
          },
          take: 1,
        },
      },
    }),
  ]);

  const stats = [
    { label: "Umsatz (30 Tage)", value: formatChf(paid30Days._sum.totalCents || 0), change: `${orderCount} Bestellungen` },
    { label: "Bestellungen", value: String(orderCount), change: "Live" },
    { label: "Produkte", value: String(productsCount), change: "Live" },
    { label: "Conversion", value: "-", change: "Noch keine Tracking-Daten" },
  ];

  const latestOrders = latestOrdersRaw as Array<{
    id: string;
    customerName: string;
    totalCents: number;
    status: string;
    items: Array<{ product: { title: string } }>;
  }>;

  const recentOrders = latestOrders.map((order) => ({
    id: order.id,
    customer: order.customerName,
    product: order.items[0]?.product.title || "-",
    amount: formatChf(order.totalCents),
    status: order.status,
  }));

  return (
    <AdminGuard>
      <div className="stagger-grid space-y-6 fade-in-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/admin/products" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition">
              Produkte verwalten
            </Link>
            <Link href="/admin/stripe" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
              Stripe & Tests
            </Link>
            <Link href="/admin/analytics" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
              Monitoring
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="panel-surface rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-xs text-emerald-600">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <section className="panel-surface rounded-2xl shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Letzte Bestellungen</h2>
            <span className="text-xs text-slate-400">Live-Daten</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="px-6 py-3 font-medium">Bestell-Nr.</th>
                  <th className="px-4 py-3 font-medium">Kunde</th>
                  <th className="px-4 py-3 font-medium">Produkt</th>
                  <th className="px-4 py-3 font-medium">Betrag</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-500">
                      Noch keine Bestellungen vorhanden.
                    </td>
                  </tr>
                )}
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{order.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-800">{order.customer}</td>
                    <td className="px-4 py-3 text-slate-600">{order.product}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{order.amount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[order.status] ?? "status-pill-hidden"}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick Links + System Notes */}
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel-surface rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Schnellzugriff</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/admin/products" className="flex items-center gap-2 rounded-lg p-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <span className="text-sky-600">→</span> Produkte & Kategorien verwalten
                </Link>
              </li>
              <li>
                <Link href="/admin/analytics" className="flex items-center gap-2 rounded-lg p-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <span className="text-sky-600">→</span> Analytics & Monitoring
                </Link>
              </li>
              <li>
                <Link href="/" className="flex items-center gap-2 rounded-lg p-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <span className="text-sky-600">→</span> Shop-Ansicht öffnen
                </Link>
              </li>
            </ul>
          </section>

          <section className="panel-surface rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">System</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-500">●</span> DB, Auth, Warenkorb und Checkout sind live an Prisma angebunden</li>
              <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-500">●</span> Lieferkosten werden zentral in Admin Einstellungen gepflegt</li>
              <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-500">●</span> E-Mail und Stripe Webhook funktionieren sobald Env-Keys gesetzt sind</li>
            </ul>
          </section>
        </div>

        <AdminOpsTools />
      </div>
    </AdminGuard>
  );
}

