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
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      <span>{label || (isDark ? "Hellmodus" : "Dunkelmodus")}</span>
    </button>
  );
}