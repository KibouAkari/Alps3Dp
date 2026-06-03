"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";

type SafeImageProps = Omit<ImageProps, "src"> & {
  src?: string;
  fallbackSrc?: string;
};

export function SafeImage({ src, fallbackSrc = "/images/placeholder-product.svg", alt, ...rest }: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);

  return (
    <Image
      {...rest}
      src={currentSrc}
      alt={alt}
      onError={() => setCurrentSrc(fallbackSrc)}
      unoptimized
    />
  );
}
