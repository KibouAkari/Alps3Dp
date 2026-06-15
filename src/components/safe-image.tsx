"use client";

/* eslint-disable @next/next/no-img-element */

import Image, { ImageProps } from "next/image";
import { useState } from "react";

type SafeImageProps = Omit<ImageProps, "src"> & {
  src?: string;
  fallbackSrc?: string;
};

export function SafeImage({ src, fallbackSrc = "/images/placeholder-product.svg", alt, ...rest }: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);
  const isExternalSource = typeof currentSrc === "string" && /^(data:image\/|https?:\/\/)/i.test(currentSrc);
  const { fill, ...imageRest } = rest as ImageProps;

  if (isExternalSource) {
    return (
      <img
        {...imageRest}
        src={currentSrc}
        alt={alt}
        loading={imageRest.loading || "lazy"}
        decoding="async"
        onError={() => setCurrentSrc(fallbackSrc)}
        className={imageRest.className}
        style={fill ? { objectFit: "cover", position: "absolute", inset: 0, width: "100%", height: "100%" } : imageRest.style}
      />
    );
  }

  return (
    <Image
      {...imageRest}
      src={currentSrc}
      alt={alt}
      onError={() => setCurrentSrc(fallbackSrc)}
      fill={fill}
      unoptimized={isExternalSource}
    />
  );
}
