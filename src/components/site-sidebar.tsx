"use client";

// Left-hand app shell navigation: branding, primary links with icons, and
// the account/login area anchored to the bottom. Collapses into a top bar
// with a slide-in drawer on small screens.
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  CartIcon,
  FilterMenuIcon,
  HomeIcon,
  InfoIcon,
  LogoutIcon,
  MailIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
import { SafeImage } from "@/components/safe-image";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { useMockSession } from "@/hooks/use-mock-session";
import { parseJsonSafely } from "@/lib/fetch-json";
import { getGuestCart } from "@/lib/guest-cart";

const navItems: Array<{ href: Route; label: string; icon: typeof HomeIcon }> = [
  { href: "/", label: "Shop", icon: HomeIcon },
  { href: "/about", label: "Über uns", icon: InfoIcon },
  { href: "/contact", label: "Kontakt", icon: MailIcon },
];

export function SiteSidebar() {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useMockSession();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const refreshCartCount = async () => {
      try {
        const response = await fetch("/api/cart", { credentials: "include", cache: "no-store" });
        const data = await parseJsonSafely(response);
        if (!active || !response.ok) {
          return;
        }
        const items = data.items as Array<{ quantity: number }> | undefined;
        const nextCount = Array.isArray(items) && items.length > 0
          ? items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)
          : getGuestCart().reduce((sum, item) => sum + item.quantity, 0);
        setCartCount(nextCount);
      } catch {
        if (active) {
          setCartCount(0);
        }
      }
    };

    const onCartUpdated = () => {
      void refreshCartCount();
    };

    void refreshCartCount();
    window.addEventListener("cart:updated", onCartUpdated);
    window.addEventListener("focus", onCartUpdated);

    return () => {
      active = false;
      window.removeEventListener("cart:updated", onCartUpdated);
      window.removeEventListener("focus", onCartUpdated);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const sidebarBody = (
    <div className="sidebar-shell flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 px-5 pb-6 pt-6">
        <Image src="/images/logo.jpeg" alt="Alps3Dp Logo" width={36} height={36} className="h-9 w-9 rounded-full" priority />
        <span className="text-lg font-bold tracking-tight text-white">
          Alps3<span className="text-violet-400">Dp</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active ? "sidebar-link-active" : ""
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <Link
          href="/cart"
          className={`sidebar-link relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            isActive("/cart") ? "sidebar-link-active" : ""
          }`}
        >
          <CartIcon className="h-4 w-4 shrink-0" />
          Warenkorb
          {cartCount > 0 && (
            <span key={cartCount} className="cart-count-bump ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1 text-[11px] font-semibold text-white">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Link>

        {!isLoading && user?.role === "ADMIN" && (
          <Link
            href="/admin"
            className={`sidebar-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isActive("/admin") ? "sidebar-link-active" : ""
            }`}
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <ThemeToggleButton className="mb-2 w-full justify-start text-slate-300 hover:text-white" />

        {!isLoading && user && (
          <div className="relative" ref={userMenuRef}>
            {isUserMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full rounded-xl border border-white/10 bg-[#181428] p-2 shadow-xl soft-pop">
                <Link
                  href="/account"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  <UserIcon />
                  Konto-Einstellungen
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    signOut();
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-400 transition hover:bg-rose-500/10"
                >
                  <LogoutIcon />
                  Logout
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white/10"
              aria-label="Konto-Menü öffnen"
            >
              <SafeImage src={user.avatar} alt={user.name} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{user.name}</span>
                <span className="block truncate text-xs text-slate-400">{user.email}</span>
              </span>
            </button>
          </div>
        )}

        {!isLoading && !user && (
          <Link
            href="/auth/login"
            className="flex items-center gap-2.5 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            <UserIcon />
            Anmelden
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-[#100c1e] px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/images/logo.jpeg" alt="Alps3Dp Logo" width={28} height={28} className="h-7 w-7 rounded-full" priority />
          <span className="text-base font-bold tracking-tight text-white">
            Alps3<span className="text-violet-400">Dp</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200"
          aria-label="Navigation öffnen"
        >
          <FilterMenuIcon className="h-4 w-4" />
          Menü
        </button>
      </header>

      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-[#100c1e] md:block">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
          <aside className="soft-pop absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-[#100c1e]">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
