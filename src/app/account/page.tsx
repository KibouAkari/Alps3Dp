"use client";

import { useEffect, useState } from "react";

import { SafeImage } from "@/components/safe-image";
import { useMockSession } from "@/hooks/use-mock-session";
import { formatChf } from "@/lib/money";

type AccountOrder = {
  id: string;
  date: string;
  status: string;
  totalCents: number;
};

export default function AccountPage() {
  const { user, isLoading, updateProfile } = useMockSession();
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [avatarDraft, setAvatarDraft] = useState(user?.avatar ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setDisplayName(user.name);
    setAvatarDraft(user.avatar);

    fetch("/api/account", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Konto konnte nicht geladen werden.");
        }
        setOrders(
          (data.orders || []).map((entry: { id: string; date: string; status: string; totalCents: number }) => ({
            id: entry.id,
            date: new Date(entry.date).toISOString().slice(0, 10),
            status: entry.status,
            totalCents: entry.totalCents,
          })),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Konto konnte nicht geladen werden."));
  }, [user]);

  if (isLoading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!user) {
    return (
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
        Bitte melde dich an, um dein Profil zu bearbeiten.
      </section>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Mein Konto</h1>
        <p className="mt-2 text-slate-600">E-Mail: {user.email}</p>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-[120px_1fr]">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200">
            <SafeImage src={avatarDraft || user.avatar} alt={displayName || user.name} fill className="object-cover" sizes="120px" />
          </div>
          <div className="space-y-3">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                setAvatarDraft(URL.createObjectURL(file));
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await updateProfile({ name: displayName.trim() || user.name, avatar: avatarDraft || user.avatar });
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 1600);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Profil konnte nicht gespeichert werden.");
                }
              }}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Profil speichern
            </button>
            {saved && <p className="text-sm text-emerald-600">Profil gespeichert und im Frontend synchronisiert.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Bestellungen</h2>
        <div className="mt-4 space-y-3">
          {orders.length === 0 && <p className="text-sm text-slate-500">Noch keine Bestellungen vorhanden.</p>}
          {orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <span>{order.id}</span>
              <span className="text-slate-500">{order.date}</span>
              <span>{order.status}</span>
              <span className="font-semibold text-sky-700">{formatChf(order.totalCents)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
