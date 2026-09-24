"use client";

// One-time splash intro on first load per browser session: brand name blurs
// into focus, a subtitle reveals word by word, an underline draws in, then
// the whole overlay fades to reveal the site. Skipped entirely on repeat
// navigations within the same session and for prefers-reduced-motion.
import { useEffect, useState } from "react";

const SESSION_KEY = "alps3dp.introShown";
const SUBTITLE = "Handgefertigt in der Schweiz";

export function IntroScreen() {
  const [phase, setPhase] = useState<"hidden" | "entering" | "leaving">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem(SESSION_KEY) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    sessionStorage.setItem(SESSION_KEY, "1");
    setPhase("entering");

    const leaveTimer = setTimeout(() => setPhase("leaving"), 2200);
    const hideTimer = setTimeout(() => setPhase("hidden"), 2900);

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") {
    return null;
  }

  return (
    <div className="intro-screen" data-leaving={phase === "leaving"} aria-hidden="true">
      <div className="text-center">
        <h1 className="intro-screen-word text-4xl font-bold tracking-tight text-[var(--fg)] sm:text-6xl" style={{ animationDelay: "150ms" }}>
          Alps3Dp
        </h1>
        <div className="intro-screen-line relative mt-5 inline-flex gap-2">
          {SUBTITLE.split(" ").map((word, index) => (
            <span
              key={word}
              className="intro-screen-word text-xs font-medium uppercase tracking-[0.3em] text-[var(--muted)] sm:text-sm"
              style={{ animationDelay: `${520 + index * 90}ms` }}
            >
              {word}
            </span>
          ))}
          <span className="intro-screen-underline" />
        </div>
      </div>
    </div>
  );
}
