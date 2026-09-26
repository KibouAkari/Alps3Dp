"use client";

// One-time splash intro on first load per browser session: a short sequence
// of phrases blur/fade through one another, then the wordmark reveals with
// a drawn underline, before the whole overlay fades to reveal the site.
// Replayed on a new visit, skipped on refresh, and shortened for reduced motion.
import { useEffect, useState } from "react";

const SESSION_KEY = "alps3dp.introShown";

const PHRASES = [
  "Jede Idee beginnt als Linie im Raum.",
  "Schicht für Schicht nimmt sie Form an.",
  "Am Ende steht ein Unikat.",
];

const PHRASE_DURATION = 2100;
const LOGO_DURATION = 2200;
const LEAVE_DURATION = 750;

export function IntroScreen() {
  const [stage, setStage] = useState<"hidden" | "phrases" | "logo" | "leaving">("hidden");
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    let hasPlayed = false;
    try {
      hasPlayed = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }

    if (hasPlayed && navigation?.type === "reload") {
      return;
    }

    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // The intro can still play when storage is unavailable.
    }

    const scheduled: ReturnType<typeof setTimeout>[] = [];
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setStage("logo");
      scheduled.push(setTimeout(() => setStage("leaving"), 1500));
      scheduled.push(setTimeout(() => setStage("hidden"), 1600));
      return () => scheduled.forEach(clearTimeout);
    }

    setStage("phrases");

    PHRASES.forEach((_, index) => {
      if (index === 0) return;
      scheduled.push(setTimeout(() => setPhraseIndex(index), index * PHRASE_DURATION));
    });

    const logoAt = PHRASES.length * PHRASE_DURATION;
    const leaveAt = logoAt + LOGO_DURATION;
    const hideAt = leaveAt + LEAVE_DURATION;

    scheduled.push(setTimeout(() => setStage("logo"), logoAt));
    scheduled.push(setTimeout(() => setStage("leaving"), leaveAt));
    scheduled.push(setTimeout(() => setStage("hidden"), hideAt));

    return () => {
      scheduled.forEach(clearTimeout);
    };
  }, []);

  if (stage === "hidden") {
    return null;
  }

  return (
    <div className="intro-screen" data-leaving={stage === "leaving"} aria-hidden="true">
      {stage === "phrases" && (
        <p
          key={phraseIndex}
          className="intro-phrase max-w-md px-6 text-center text-lg font-medium tracking-tight text-[var(--fg)] sm:text-2xl"
          style={{ "--intro-phrase-duration": `${PHRASE_DURATION}ms` } as React.CSSProperties}
        >
          {PHRASES[phraseIndex]}
        </p>
      )}

      {(stage === "logo" || stage === "leaving") && (
        <div className="text-center">
          <h1 className="intro-screen-title text-4xl font-bold leading-none tracking-tight text-[var(--fg)] sm:text-7xl">
            Alps3Dp
          </h1>
          <div className="intro-screen-line relative mt-8 inline-flex gap-2 sm:mt-10">
            <span
              className="intro-screen-word text-xs font-medium uppercase tracking-[0.35em] text-[var(--muted)] sm:text-sm"
              style={{ animationDelay: "260ms" }}
            >
              3D-Druck · Präzision · Schweiz
            </span>
            <span className="intro-screen-underline" />
          </div>
        </div>
      )}
    </div>
  );
}
