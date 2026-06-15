import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Alps3Dp",
  description: "Handgefertigte 3D-gedruckte Produkte aus der Schweiz.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased transition-colors duration-300" suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => { try { const stored = localStorage.getItem('alps3dp.theme'); const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; const theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light'); document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; } catch (error) {} })();`}
        </Script>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
