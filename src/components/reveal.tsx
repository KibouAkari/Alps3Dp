"use client";

// Scroll-triggered reveal wrapper: fades/blurs children in once they enter the
// viewport. Used across pages for a subtle, premium "content arriving" feel.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  delay?: number;
  variant?: "up" | "fade";
  group?: boolean;
};

export function Reveal({ children, className = "", as = "div", delay = 0, variant = "up", group = false }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  const variantClass = variant === "fade" ? "reveal-fade" : "";

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${variantClass} ${isVisible ? "reveal-visible" : ""} ${group ? "reveal-group" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
