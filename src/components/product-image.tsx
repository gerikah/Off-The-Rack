"use client";
import Image, { type ImageProps } from "next/image";
export function ProductImageView({ src, alt, ...props }: ImageProps) {
  return <Image {...props} src={src} alt={alt} />;
}
