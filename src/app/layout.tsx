import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { getAppBaseUrl } from "@/lib/app-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  title: {
    default: "Alps3Dp",
    template: "%s | Alps3Dp",
  },
  description: "Handgefertigte 3D-gedruckte Produkte aus der Schweiz.",
  keywords: [
    "3D Druck Schweiz",
    "3D Print Shop",
    "personalisierte 3D Produkte",
    "Alps3Dp",
    "3D gedruckte Geschenke",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Alps3Dp",
    description: "Handgefertigte 3D-gedruckte Produkte aus der Schweiz.",
    type: "website",
    locale: "de_CH",
    url: getAppBaseUrl(),
    siteName: "Alps3Dp",
    images: [
      {
        url: "/images/logo.png",
        width: 512,
        height: 512,
        alt: "Alps3Dp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alps3Dp",
    description: "Handgefertigte 3D-gedruckte Produkte aus der Schweiz.",
    images: ["/images/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
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
