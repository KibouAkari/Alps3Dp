"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMockSession } from "@/hooks/use-mock-session";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useMockSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm soft-pop">
      <h1 className="text-2xl font-bold text-slate-900">Anmelden</h1>
      {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setStatus(null);
          try {
            const user = await signIn({ email, password });
            router.push(user.role === "ADMIN" ? "/admin" : "/account");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login fehlgeschlagen.");
          }
        }}
      >
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
          Login
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm text-slate-500">
        <Link href="/auth/forgot-password" className="hover:text-sky-700">
          Passwort vergessen?
        </Link>
        <Link href="/auth/register" className="hover:text-sky-700">
          Konto erstellen
        </Link>
      </div>
    </div>
  );
}
