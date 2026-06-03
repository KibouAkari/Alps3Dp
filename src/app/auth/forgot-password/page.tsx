"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm soft-pop">
      <h1 className="text-2xl font-bold text-slate-900">Passwort zurücksetzen</h1>
      <p className="mt-2 text-sm text-slate-600">Wir senden dir einen sicheren Reset-Link per E-Mail.</p>
      {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setStatus(null);
          setError(null);

          const response = await fetch("/api/password/forgot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });

          const data = await response.json();
          if (!response.ok) {
            setError(data.error || "Fehler beim Versand des Reset-Links.");
            return;
          }

          setStatus("Wenn ein Konto existiert, wurde ein Reset-Link versendet.");
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-Mail"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <button type="submit" className="w-full rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700">
          Reset-Link senden
        </button>
      </form>
    </div>
  );
}
