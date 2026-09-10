"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { PRODUCT_IMAGE_FALLBACK } from "@/lib/product-utils";
export function ProductImageView({ src, alt, ...props }: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  return (
    <Image
      {...props}
      src={failedSrc === src ? PRODUCT_IMAGE_FALLBACK : src}
      alt={alt}
      onError={() => setFailedSrc(src)}
    />
  );
}
