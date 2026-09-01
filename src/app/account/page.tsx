"use client";

// Customer account dashboard: profile, saved addresses/payment methods,
// and order history, all driven by /api/account and /api/account/*.
import { useEffect, useMemo, useState } from "react";

import { SafeImage } from "@/components/safe-image";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { useMockSession } from "@/hooks/use-mock-session";
import { parseJsonSafely } from "@/lib/fetch-json";
import { formatChf } from "@/lib/money";
import { formatOrderNumber } from "@/lib/order-number";

type AccountOrder = {
  id: string;
  orderNumber: number;
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

type TabKey = "overview" | "profile" | "security" | "delivery" | "orders";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Übersicht" },
  { key: "profile", label: "Profil" },
  { key: "security", label: "Sicherheit" },
  { key: "delivery", label: "Adressen" },
  { key: "orders", label: "Bestellungen" },
];

export default function AccountPage() {
  const { user, isLoading, updateProfile } = useMockSession();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [salutation, setSalutation] = useState<"" | "Herr" | "Frau">("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
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


  const [saved, setSaved] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
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

    fetch("/api/account", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = await parseJsonSafely(response);
        if (!response.ok) {
          throw new Error((data.error as string | undefined) || "Konto konnte nicht geladen werden.");
        }
        setOrders(
          ((data.orders as Array<{ id: string; orderNumber: number; date: string; status: string; totalCents: number }> | undefined) || []).map((entry) => ({
            id: entry.id,
            orderNumber: entry.orderNumber,
            date: new Date(entry.date).toISOString().slice(0, 10),
            status: entry.status,
            totalCents: entry.totalCents,
          }))
        );
        const profile = data.profile as { addresses?: SavedAddress[]; email?: string } | undefined;
        setAddresses(profile?.addresses || []);
        setNewEmail(profile?.email || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Konto konnte nicht geladen werden."));
  }, [user]);

  const defaultAddress = useMemo(() => addresses.find((entry) => entry.isDefault), [addresses]);
  const profileCompletion = useMemo(() => {
    const checks = [Boolean(user?.firstName), Boolean(user?.lastName), Boolean(user?.username), Boolean(defaultAddress)];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [defaultAddress, user?.firstName, user?.lastName, user?.username]);

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
      <section className="panel-surface rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Mein Konto</h1>
        <p className="mt-1 text-sm text-slate-600">Alles ist in klare Schritte aufgeteilt, damit es einfacher bleibt.</p>
        {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  activeTab === tab.key ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ThemeToggleButton label="Design wechseln" />
        </div>
      </section>

      {activeTab === "overview" && (
        <section className="stagger-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="account-overview-card hover-lift rounded-2xl p-5 shadow-sm soft-pop">
            <p className="text-xs uppercase tracking-wide text-slate-500">Profil</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {user.salutation ? `${user.salutation} ` : ""}
              {user.firstName || user.lastName ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : user.name}
            </p>
            {user.username && <p className="text-sm text-slate-600">@{user.username}</p>}
            <p className="text-sm text-slate-600">{user.email}</p>
          </div>
          <div className="account-overview-card hover-lift rounded-2xl p-5 shadow-sm soft-pop">
            <p className="text-xs uppercase tracking-wide text-slate-500">Standardadresse</p>
            {defaultAddress ? (
              <p className="mt-2 text-sm text-slate-900">
                {defaultAddress.firstName} {defaultAddress.lastName}, {defaultAddress.street}, {defaultAddress.zipCode} {defaultAddress.city}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Noch keine Adresse gespeichert.</p>
            )}
          </div>
          <div className="account-overview-card hover-lift rounded-2xl p-5 shadow-sm soft-pop">
            <p className="text-xs uppercase tracking-wide text-slate-500">Standardzahlung</p>
            <p className="mt-2 text-sm text-slate-900">Kreditkarte via Stripe</p>
            <p className="text-sm text-slate-600">Kartenangaben werden sicher von Stripe verarbeitet.</p>
          </div>
          <div className="account-overview-card hover-lift rounded-2xl p-5 shadow-sm soft-pop">
            <p className="text-xs uppercase tracking-wide text-slate-500">Profilstatus</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{profileCompletion}%</p>
            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-sky-600 transition-all duration-500" style={{ width: `${profileCompletion}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Vollständiges Profil verbessert Checkout und Support.</p>
          </div>
        </section>
      )}

      {activeTab === "profile" && (
        <section className="panel-surface rounded-2xl p-6 shadow-sm soft-pop">
          <h2 className="text-lg font-semibold text-slate-900">Profil bearbeiten</h2>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-white">
              <SafeImage src={user.avatar} alt={user.name} fill className="object-cover" sizes="80px" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">Profilbild</p>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                Bild hochladen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const files = event.currentTarget.files;
                    if (!files || files.length === 0) {
                      return;
                    }

                    const payload = new FormData();
                    payload.append("scope", "avatar");
                    payload.append("files", files[0]);

                    setIsAvatarUploading(true);
                    setError(null);
                    setStatus(null);
                    try {
                      const response = await fetch("/api/uploads", {
                        method: "POST",
                        credentials: "include",
                        body: payload,
                      });
                      const data = await parseJsonSafely(response);
                      if (!response.ok) {
                        throw new Error((data.error as string | undefined) || "Avatar konnte nicht hochgeladen werden.");
                      }

                      const nextAvatar = (data.urls as string[] | undefined)?.[0];
                      if (!nextAvatar) {
                        throw new Error("Avatar konnte nicht gespeichert werden.");
                      }

                      await updateProfile({ avatar: nextAvatar });
                      setStatus("Profilbild aktualisiert.");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Avatar konnte nicht hochgeladen werden.");
                    } finally {
                      setIsAvatarUploading(false);
                      event.currentTarget.value = "";
                    }
                  }}
                />
              </label>
              {isAvatarUploading && <p className="text-xs text-sky-700">Lade Profilbild hoch...</p>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              value={salutation}
              onChange={(event) => setSalutation(event.target.value as "" | "Herr" | "Frau")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Anrede (optional)</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
            </select>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Vorname"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Nachname"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
          </div>
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
            className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Profil speichern
          </button>
          {saved && <p className="mt-2 text-sm text-emerald-600">Profil synchronisiert.</p>}
        </section>
      )}

      {activeTab === "security" && (
        <section className="stagger-grid grid gap-4 md:grid-cols-2">
          <div className="panel-surface rounded-2xl p-6 shadow-sm soft-pop">
            <h2 className="text-lg font-semibold text-slate-900">E-Mail ändern</h2>
            <div className="mt-4 space-y-3">
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
                placeholder="Aktuelles Passwort"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
            </div>
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
                  const data = await parseJsonSafely(response);
                  if (!response.ok) {
                    throw new Error((data.error as string | undefined) || "E-Mail konnte nicht aktualisiert werden.");
                  }
                  setStatus("E-Mail geändert. Bitte Verifizierungs-Mail bestätigen.");
                  setEmailPassword("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "E-Mail konnte nicht aktualisiert werden.");
                }
              }}
              className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              E-Mail aktualisieren
            </button>
          </div>

          <div className="panel-surface rounded-2xl p-6 shadow-sm soft-pop">
            <h2 className="text-lg font-semibold text-slate-900">Passwort ändern</h2>
            <div className="mt-4 space-y-3">
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
            </div>
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
                  const data = await parseJsonSafely(response);
                  if (!response.ok) {
                    throw new Error((data.error as string | undefined) || "Passwort konnte nicht aktualisiert werden.");
                  }
                  setStatus("Passwort erfolgreich geändert.");
                  setCurrentPassword("");
                  setNewPassword("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Passwort konnte nicht aktualisiert werden.");
                }
              }}
              className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Passwort aktualisieren
            </button>
          </div>
        </section>
      )}

      {activeTab === "delivery" && (
        <section className="stagger-grid grid gap-4 lg:grid-cols-2">
          <div className="panel-surface rounded-2xl p-6 shadow-sm soft-pop">
            <h2 className="text-lg font-semibold text-slate-900">Gespeicherte Adressen</h2>
            <div className="mt-4 space-y-3">
              {addresses.length === 0 && <p className="text-sm text-slate-500">Noch keine Adresse gespeichert.</p>}
              {addresses.map((address) => (
                <div key={address.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-900">
                    {address.salutation ? `${address.salutation} ` : ""}
                    {address.firstName} {address.lastName}
                  </p>
                  <p className="text-slate-600">{address.street}</p>
                  <p className="text-slate-600">
                    {address.zipCode} {address.city}, {address.country}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    {address.isDefault && <p className="text-xs font-semibold text-emerald-700">Standard</p>}
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
                      className="text-xs text-rose-600 hover:text-rose-700"
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowNewAddressForm((prev) => !prev)}
              className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              {showNewAddressForm ? "Formular schließen" : "Neue Adresse hinzufügen"}
            </button>

            {showNewAddressForm && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <select
                  value={addressForm.salutation}
                  onChange={(event) =>
                    setAddressForm((prev) => ({ ...prev, salutation: event.target.value as "" | "Herr" | "Frau" }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="">Anrede</option>
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                </select>
                <input
                  value={addressForm.firstName}
                  onChange={(e) => setAddressForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Vorname"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
                <input
                  value={addressForm.lastName}
                  onChange={(e) => setAddressForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Nachname"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
                <input
                  value={addressForm.street}
                  onChange={(e) => setAddressForm((p) => ({ ...p, street: e.target.value }))}
                  placeholder="Straße"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
                <input
                  value={addressForm.zipCode}
                  onChange={(e) => setAddressForm((p) => ({ ...p, zipCode: e.target.value }))}
                  placeholder="PLZ"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
                <input
                  value={addressForm.city}
                  onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Ort"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  />
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
                    const data = await parseJsonSafely(response);
                    if (!response.ok) {
                      setError((data.error as string | undefined) || "Adresse konnte nicht gespeichert werden.");
                      return;
                    }
                    const savedAddress = data.address as SavedAddress;
                    setAddresses((prev) => [savedAddress, ...prev.filter((a) => !savedAddress.isDefault || !a.isDefault)]);
                    setAddressForm({ salutation: "", firstName: "", lastName: "", street: "", zipCode: "", city: "", country: "CH", isDefault: false });
                    setShowNewAddressForm(false);
                    setStatus("Adresse gespeichert.");
                  }}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 sm:col-span-2"
                >
                  Adresse speichern
                </button>
              </div>
            )}
          </div>

        </section>
      )}

      {activeTab === "orders" && (
        <section className="panel-surface rounded-2xl p-6 shadow-sm soft-pop">
          <h2 className="text-lg font-semibold text-slate-900">Bestellungen</h2>
          <div className="mt-4 space-y-3">
            {orders.length === 0 && <p className="text-sm text-slate-500">Noch keine Bestellungen vorhanden.</p>}
            {orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <span className="font-mono font-medium text-slate-800">{formatOrderNumber(order.orderNumber)}</span>
                <span className="text-slate-500">{order.date}</span>
                <span>{order.status}</span>
                <span className="font-semibold text-sky-700">{formatChf(order.totalCents)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}