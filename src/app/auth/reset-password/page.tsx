"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm soft-pop">
      <h1 className="text-2xl font-bold text-slate-900">Neues Passwort setzen</h1>
      {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setStatus(null);
          setError(null);

          if (!token) {
            setError("Reset-Token fehlt.");
            return;
          }

          if (password !== confirm) {
            setError("Passwoerter stimmen nicht ueberein.");
            return;
          }

          const response = await fetch("/api/password/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
          });
          const data = await response.json();

          if (!response.ok) {
            setError(data.error || "Passwort konnte nicht aktualisiert werden.");
            return;
          }

          setStatus("Passwort erfolgreich aktualisiert. Bitte neu einloggen.");
          setPassword("");
          setConfirm("");
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Neues Passwort"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="Passwort wiederholen"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <button type="submit" className="w-full rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700">
          Passwort aktualisieren
        </button>
      </form>
    </div>
  );
}
