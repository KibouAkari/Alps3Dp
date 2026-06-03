"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMockSession } from "@/hooks/use-mock-session";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useMockSession();
  const [salutation, setSalutation] = useState<"" | "Herr" | "Frau">("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm soft-pop">
      <h1 className="text-2xl font-bold text-slate-900">Konto erstellen</h1>
      {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setStatus(null);
          try {
            await register({
              salutation: salutation || undefined,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              username: username || undefined,
              email,
              password,
            });
            setStatus("Registrierung erfolgreich. Bitte bestaetige deine E-Mail.");
            router.push("/account");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen.");
          }
        }}
      >
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
          type="text"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="Vorname (optional)"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <input
          type="text"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Nachname (optional)"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username (optional, z.B. max.muster)"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-Mail"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Passwort"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
        <button type="submit" className="w-full rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white transition hover:bg-sky-700">
          Registrieren
        </button>
      </form>
    </div>
  );
}
