"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CartIcon, LogoutIcon, SettingsIcon, UserIcon } from "@/components/icons";
import { SafeImage } from "@/components/safe-image";
import { useMockSession } from "@/hooks/use-mock-session";

export function SiteHeader() {
  const { user, isLoading, signOut } = useMockSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/images/logo.svg" alt="Alps3Dp Logo" width={36} height={36} className="h-9 w-9" priority />
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Alps3<span className="text-[#4AB4C4]">Dp</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-3 text-sm text-slate-600 md:flex">
          <Link href="/" className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
            Shop
          </Link>
          <Link href="/about" className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
            About
          </Link>
          <Link href="/contact" className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
            Kontakt
          </Link>
        </nav>

        <div className="flex items-center gap-2" ref={menuRef}>
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <CartIcon />
            <span className="hidden sm:inline">Warenkorb</span>
          </Link>

          {!isLoading && user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                className="inline-flex items-center rounded-full border border-slate-200 p-0.5 transition hover:shadow"
                aria-label="Profil-Menue öffnen"
              >
                <SafeImage src={user.avatar} alt={user.name} width={34} height={34} className="h-8 w-8 rounded-full object-cover" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-11 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg soft-pop">
                  <div className="rounded-lg px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setIsMenuOpen(false)}
                    className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <UserIcon />
                    Settings
                  </Link>
                  {user.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      <SettingsIcon />
                      Admin Zugang
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut();
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogoutIcon />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
          {!isLoading && !user && (
            <Link href="/auth/login" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800">
              Anmelden
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
