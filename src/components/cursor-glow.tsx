"use client";

// Fixed full-screen radial glow that follows the pointer, only on
// fine-pointer (desktop) devices and when reduced motion isn't requested.
import { useEffect, useState } from "react";

export function CursorGlow() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinePointer || reduceMotion) return;

    const handleMove = (event: MouseEvent) => {
      document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
      setActive(true);
    };
    const handleLeave = () => setActive(false);

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return <div className={`cursor-glow ${active ? "cursor-glow-active" : ""}`} aria-hidden="true" />;
}
