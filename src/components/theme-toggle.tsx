"use client";

import { MoonIcon, SunIcon } from "@/components/icons";
import { useTheme } from "@/components/theme-provider";

type ThemeToggleProps = {
  className?: string;
  label?: string;
};

export function ThemeToggleButton({ className = "", label }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      className={`theme-pill hover-lift inline-grid grid-cols-2 items-center rounded-xl p-1 text-sm text-slate-700 ${className}`}
    >
      <span className={`inline-flex min-w-[78px] items-center justify-center gap-1 rounded-lg px-2 py-1 transition ${!isDark ? "bg-slate-200 text-slate-900" : "opacity-70"}`}>
        <MoonIcon className="h-3.5 w-3.5" />
        Hell
      </span>
      <span className={`inline-flex min-w-[78px] items-center justify-center gap-1 rounded-lg px-2 py-1 transition ${isDark ? "bg-slate-700 text-slate-100" : "opacity-70"}`}>
        <SunIcon className="h-3.5 w-3.5" />
        Dunkel
      </span>
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
}