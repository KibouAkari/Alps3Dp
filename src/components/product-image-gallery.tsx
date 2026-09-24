"use client";

// Product detail page image viewer: a large preview with clickable thumbnails
// plus left/right arrow controls and keyboard navigation for multi-image products.
import { useCallback, useEffect, useState } from "react";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { SafeImage } from "@/components/safe-image";

type ProductImageGalleryProps = {
  images: string[];
  title: string;
};

export function ProductImageGallery({ images, title }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;
  const currentImage = images[activeIndex] || images[0];

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % images.length) + images.length) % images.length);
    },
    [images.length],
  );

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  // Left/right arrow keys navigate the gallery whenever it's visible, since
  // this is the only interactive image control on the page.
  useEffect(() => {
    if (!hasMultiple) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasMultiple, goPrev, goNext]);

  return (
    <div className="space-y-3">
      <div className="glass-hover group relative h-[360px] overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm sm:h-[460px]">
        <SafeImage
          key={activeIndex}
          src={currentImage}
          alt={`${title} Ansicht ${activeIndex + 1}`}
          fill
          priority
          className="fade-in-up object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Vorheriges Bild"
              className="press glass-hover absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-[var(--surface-border)] bg-[var(--bg-soft)]/80 p-2 text-[var(--fg)] opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Nächstes Bild"
              className="press glass-hover absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-[var(--surface-border)] bg-[var(--bg-soft)]/80 p-2 text-[var(--fg)] opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            <span className="chip absolute bottom-3 right-3 z-10 bg-[var(--bg-soft)]/80">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Bild ${index + 1} anzeigen`}
                aria-current={isActive}
                className={`press relative h-20 overflow-hidden rounded-lg border bg-[var(--surface)] transition ${
                  isActive ? "border-[var(--fg)] ring-2 ring-[var(--accent-soft)]" : "border-[var(--surface-border)] hover:border-[var(--gray)]"
                }`}
              >
                <SafeImage src={image} alt={`${title} Vorschau ${index + 1}`} fill className="object-cover" sizes="120px" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
