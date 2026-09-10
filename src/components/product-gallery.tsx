"use client";
import { ProductImageView } from "./product-image";
import type { ProductImage } from "@/lib/types";
import {
  getGalleryImages,
  productImageUrl,
  PRODUCT_IMAGE_FALLBACK,
} from "@/lib/product-utils";
import { useState } from "react";
export function ProductGallery({
  images,
  alt,
}: {
  images: ProductImage[];
  alt: string;
}) {
  const [selected, setSelected] = useState(0);
  const source = images.length
    ? getGalleryImages(images).map((image) => ({
        id: image.id,
        src: productImageUrl(image.image_url),
        alt: image.alt_text || alt,
      }))
    : [{ id: "fallback", src: PRODUCT_IMAGE_FALLBACK, alt }];
  return (
    <div className="product-gallery">
      <div className="gallery-primary">
        <ProductImageView
          src={source[selected].src}
          alt={`${source[selected].alt} — view ${selected + 1}`}
          fill
          preload
          sizes="(max-width: 767px) 100vw, 60vw"
        />
        <span className="gallery-counter">
          {String(selected + 1).padStart(2, "0")} /{" "}
          {String(source.length).padStart(2, "0")}
        </span>
      </div>
      {source.length > 1 && (
        <div
          className="gallery-thumbnails"
          role="group"
          aria-label="Product views"
        >
          {source.map((image, i) => (
            <button
              key={image.id}
              aria-label={`Show view ${i + 1}`}
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
            >
              <ProductImageView
                src={image.src}
                alt={`Thumbnail of view ${i + 1}`}
                fill
                sizes="120px"
              />
            </button>
          ))}
        </div>
      )}
      <p className="gallery-note eyebrow">
        HAND-PAINTED DETAILS. NO TWO PIECES ALIKE.
      </p>
    </div>
  );
}
