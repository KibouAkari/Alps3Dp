"use client";

import { useState } from "react";

import { SafeImage } from "@/components/safe-image";

type ProductImageGalleryProps = {
  images: string[];
  title: string;
};

export function ProductImageGallery({ images, title }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const currentImage = images[activeIndex] || images[0];

  return (
    <div className="space-y-3">
      <div className="relative h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-[460px]">
        <SafeImage src={currentImage} alt={title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {images.map((image, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative h-20 overflow-hidden rounded-lg border bg-white transition ${
                isActive ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200 hover:border-sky-300"
              }`}
            >
              <SafeImage src={image} alt={`${title} Ansicht ${index + 1}`} fill className="object-cover" sizes="120px" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
