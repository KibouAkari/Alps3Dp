"use client";

// Wraps route content and replays a subtle fade/blur/slide-in animation
// whenever the pathname changes, giving the app a smooth page-transition feel.
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
