"use client";

import { useEffect, useState } from "react";

import { useMockSession } from "@/hooks/use-mock-session";
import { formatChf } from "@/lib/money";

type AccountOrder = {
  id: string;
  date: string;
  status: string;
  totalCents: number;
};

type SavedAddress = {
  id: string;
  salutation: string | null;
  firstName: string;
  lastName: string;
  street: string;
  zipCode: string;
  city: string;
  country: string;
  isDefault: boolean;
};

type SavedPaymentMethod = {
  id: string;
  type: "card" | "twint";
  last4: string | null;
  holderName: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
};

export default function AccountPage() {
  const { user, isLoading, updateProfile } = useMockSession();
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [salutation, setSalutation] = useState<"" | "Herr" | "Frau">("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [payments, setPayments] = useState<SavedPaymentMethod[]>([]);
  const [addressForm, setAddressForm] = useState({
    salutation: "" as "" | "Herr" | "Frau",
    firstName: "",
    lastName: "",
    street: "",
    zipCode: "",
    city: "",
    country: "CH",
    isDefault: false,
  });
  const [paymentForm, setPaymentForm] = useState({
    type: "card" as "card" | "twint",
    holderName: "",
    last4: "",
    expiryMonth: "",
    expiryYear: "",
    isDefault: false,
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setUsername(user.username || "");
    setSalutation((user.salutation as "Herr" | "Frau" | null) || "");

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
        setAddresses(data.profile?.addresses || []);
        setPayments(data.profile?.paymentMethods || []);
        setNewEmail(data.profile?.email || "");
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
        <p className="mt-2 text-slate-600">Aktuelle E-Mail: {user.email}</p>
        {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Profil</h2>
            <select
              value={salutation}
              onChange={(event) => setSalutation(event.target.value as "" | "Herr" | "Frau")}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Anrede (optional)</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
            </select>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Vorname"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Nachname"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  setError(null);
                  setStatus(null);
                  await updateProfile({
                    firstName: firstName || undefined,
                    lastName: lastName || undefined,
                    salutation: salutation || undefined,
                    username: username || undefined,
                  });
                  setSaved(true);
                  setStatus("Profil erfolgreich gespeichert.");
                  window.setTimeout(() => setSaved(false), 1600);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Profil konnte nicht gespeichert werden.");
                }
              }}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Profil speichern
            </button>
            {saved && <p className="text-sm text-emerald-600">Profil synchronisiert.</p>}
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">E-Mail & Passwort</h2>
            <input
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="Neue E-Mail"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <input
              type="password"
              value={emailPassword}
              onChange={(event) => setEmailPassword(event.target.value)}
              placeholder="Aktuelles Passwort (für E-Mail-Änderung)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  setError(null);
                  setStatus(null);
                  const response = await fetch("/api/account/email", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ newEmail, currentPassword: emailPassword }),
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data.error || "E-Mail konnte nicht aktualisiert werden.");
                  }
                  setStatus("E-Mail geaendert. Bitte E-Mail-Link zur Verifizierung nutzen.");
                  setEmailPassword("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "E-Mail konnte nicht aktualisiert werden.");
                }
              }}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              E-Mail aktualisieren
            </button>

            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Aktuelles Passwort"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Neues Passwort"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  setError(null);
                  setStatus(null);
                  const response = await fetch("/api/account/password", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ currentPassword, newPassword }),
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data.error || "Passwort konnte nicht aktualisiert werden.");
                  }
                  setStatus("Passwort erfolgreich geaendert.");
                  setCurrentPassword("");
                  setNewPassword("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Passwort konnte nicht aktualisiert werden.");
                }
              }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Passwort aktualisieren
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Gespeicherte Adressen</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-semibold text-slate-900">{address.salutation ? `${address.salutation} ` : ""}{address.firstName} {address.lastName}</p>
              <p className="text-slate-600">{address.street}</p>
              <p className="text-slate-600">{address.zipCode} {address.city}, {address.country}</p>
              {address.isDefault && <p className="mt-1 text-xs font-semibold text-emerald-700">Standard</p>}
              <button
                type="button"
                onClick={async () => {
                  const response = await fetch(`/api/account/addresses/${address.id}`, {
                    method: "DELETE",
                    credentials: "include",
                  });
                  if (response.ok) {
                    setAddresses((prev) => prev.filter((a) => a.id !== address.id));
                  }
                }}
                className="mt-2 text-xs text-rose-600 hover:text-rose-700"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <select
            value={addressForm.salutation}
            onChange={(event) => setAddressForm((prev) => ({ ...prev, salutation: event.target.value as "" | "Herr" | "Frau" }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            <option value="">Anrede</option>
            <option value="Herr">Herr</option>
            <option value="Frau">Frau</option>
          </select>
          <input value={addressForm.firstName} onChange={(e) => setAddressForm((p) => ({ ...p, firstName: e.target.value }))} placeholder="Vorname" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={addressForm.lastName} onChange={(e) => setAddressForm((p) => ({ ...p, lastName: e.target.value }))} placeholder="Nachname" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={addressForm.street} onChange={(e) => setAddressForm((p) => ({ ...p, street: e.target.value }))} placeholder="Strasse" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={addressForm.zipCode} onChange={(e) => setAddressForm((p) => ({ ...p, zipCode: e.target.value }))} placeholder="PLZ" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} placeholder="Ort" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm((p) => ({ ...p, isDefault: e.target.checked }))} />
            Als Standard setzen
          </label>
          <button
            type="button"
            onClick={async () => {
              const response = await fetch("/api/account/addresses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(addressForm),
              });
              const data = await response.json();
              if (!response.ok) {
                setError(data.error || "Adresse konnte nicht gespeichert werden.");
                return;
              }
              setAddresses((prev) => [data.address, ...prev.filter((a) => !data.address.isDefault || !a.isDefault)]);
              setAddressForm({ salutation: "", firstName: "", lastName: "", street: "", zipCode: "", city: "", country: "CH", isDefault: false });
            }}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Adresse speichern
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Gespeicherte Zahlungsarten</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {payments.map((method) => (
            <div key={method.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-semibold text-slate-900">{method.type === "card" ? "Karte" : "TWINT"}</p>
              {method.last4 && <p className="text-slate-600">**** {method.last4}</p>}
              {method.holderName && <p className="text-slate-600">{method.holderName}</p>}
              {method.expiryMonth && method.expiryYear && <p className="text-slate-600">{method.expiryMonth}/{method.expiryYear}</p>}
              {method.isDefault && <p className="mt-1 text-xs font-semibold text-emerald-700">Standard</p>}
              <button
                type="button"
                onClick={async () => {
                  const response = await fetch(`/api/account/payment-methods/${method.id}`, {
                    method: "DELETE",
                    credentials: "include",
                  });
                  if (response.ok) {
                    setPayments((prev) => prev.filter((m) => m.id !== method.id));
                  }
                }}
                className="mt-2 text-xs text-rose-600 hover:text-rose-700"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <select
            value={paymentForm.type}
            onChange={(event) => setPaymentForm((prev) => ({ ...prev, type: event.target.value as "card" | "twint" }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            <option value="card">Kreditkarte</option>
            <option value="twint">TWINT</option>
          </select>
          <input value={paymentForm.holderName} onChange={(e) => setPaymentForm((p) => ({ ...p, holderName: e.target.value }))} placeholder="Karteninhaber" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={paymentForm.last4} onChange={(e) => setPaymentForm((p) => ({ ...p, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="Letzte 4 Ziffern" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={paymentForm.expiryMonth} onChange={(e) => setPaymentForm((p) => ({ ...p, expiryMonth: e.target.value.replace(/\D/g, "").slice(0, 2) }))} placeholder="Monat (MM)" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <input value={paymentForm.expiryYear} onChange={(e) => setPaymentForm((p) => ({ ...p, expiryYear: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="Jahr (YYYY)" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={paymentForm.isDefault} onChange={(e) => setPaymentForm((p) => ({ ...p, isDefault: e.target.checked }))} />
            Als Standard setzen
          </label>
          <button
            type="button"
            onClick={async () => {
              const response = await fetch("/api/account/payment-methods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  type: paymentForm.type,
                  holderName: paymentForm.holderName || undefined,
                  last4: paymentForm.last4 || undefined,
                  expiryMonth: paymentForm.expiryMonth ? Number(paymentForm.expiryMonth) : undefined,
                  expiryYear: paymentForm.expiryYear ? Number(paymentForm.expiryYear) : undefined,
                  isDefault: paymentForm.isDefault,
                }),
              });
              const data = await response.json();
              if (!response.ok) {
                setError(data.error || "Zahlungsart konnte nicht gespeichert werden.");
                return;
              }
              setPayments((prev) => [data, ...prev.filter((m) => !data.isDefault || !m.isDefault)]);
              setPaymentForm({ type: "card", holderName: "", last4: "", expiryMonth: "", expiryYear: "", isDefault: false });
            }}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Zahlungsart speichern
          </button>
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
