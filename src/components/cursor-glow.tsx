"use client";

// Fixed full-screen radial glow that follows the pointer, only on
// fine-pointer (desktop) devices and when reduced motion isn't requested.
import { useEffect, useRef, useState } from "react";

export function CursorGlow() {
  const [active, setActive] = useState(false);
  const hasActivated = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinePointer || reduceMotion) return;

    // Position updates go straight to a CSS var (no React state) so every
    // mousemove doesn't trigger a re-render; only the one-time "activate"
    // flip needs React state, and requestAnimationFrame coalesces bursts of
    // move events into at most one style write per frame.
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;

    const applyPosition = () => {
      rafId = 0;
      document.documentElement.style.setProperty("--cursor-x", `${pendingX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${pendingY}px`);
    };

    const handleMove = (event: MouseEvent) => {
      pendingX = event.clientX;
      pendingY = event.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(applyPosition);
      }
      if (!hasActivated.current) {
        hasActivated.current = true;
        setActive(true);
      }
    };
    const handleLeave = () => {
      hasActivated.current = false;
      setActive(false);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return <div className={`cursor-glow ${active ? "cursor-glow-active" : ""}`} aria-hidden="true" />;
}
