"use client";

import Link from "next/link";

import { useMockSession } from "@/hooks/use-mock-session";

type AdminGuardProps = {
  children: React.ReactNode;
};

export function AdminGuard({ children }: AdminGuardProps) {
  const { isLoading, user } = useMockSession();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Admin-Zugriff erforderlich</h1>
        <p className="mt-2 text-sm">Bitte melde dich mit einem Admin-Konto an, um diese Seite zu sehen.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/auth/login" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">
            Zum Login
          </Link>
          <Link href="/" className="rounded-lg border border-amber-300 px-4 py-2 text-sm">
            Zur Shop Startseite
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
