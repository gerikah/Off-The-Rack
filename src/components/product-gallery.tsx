"use client";
import { ProductImageView } from "./product-image";
import type { ProductImage } from "@/lib/types";
import {
  getGalleryImages,
  productImageUrl,
  PRODUCT_IMAGE_FALLBACK,
} from "@/lib/product-utils";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Arrow } from "./ui";
export function ProductGallery({
  images,
  alt,
}: {
  images: ProductImage[];
  alt: string;
}) {
  const [selected, setSelected] = useState(0);
  const instructionsId = useId();
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([]);
  const source = images.length
    ? getGalleryImages(images).map((image) => ({
        id: image.id,
        src: productImageUrl(image.image_url),
        alt: image.alt_text?.trim() || alt,
      }))
    : [{ id: "fallback", src: PRODUCT_IMAGE_FALLBACK, alt }];
  const current = selected % source.length;
  const select = (index: number) =>
    setSelected((index + source.length) % source.length);
  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    const focused = thumbnails.current.indexOf(
      event.target as HTMLButtonElement,
    );
    const base = focused >= 0 ? focused : current;
    const next =
      event.key === "ArrowRight"
        ? (base + 1) % source.length
        : event.key === "ArrowLeft"
          ? (base - 1 + source.length) % source.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? source.length - 1
              : null;
    if (next === null || source.length < 2) return;
    event.preventDefault();
    select(next);
    if (thumbnails.current.includes(event.target as HTMLButtonElement))
      thumbnails.current[next]?.focus();
  };
  return (
    <div className="product-gallery" onKeyDown={handleKey}>
      <div
        className="gallery-primary"
        role="group"
        aria-label="Product image gallery"
        aria-describedby={source.length > 1 ? instructionsId : undefined}
        tabIndex={source.length > 1 ? 0 : undefined}
      >
        <div className="gallery-image-frame" key={source[current].id}>
          <ProductImageView
            src={source[current].src}
            alt={`${source[current].alt} — view ${current + 1}`}
            fill
            preload={current === 0}
            loading={current === 0 ? undefined : "eager"}
            sizes="(max-width: 767px) 100vw, 60vw"
          />
        </div>
        <span className="gallery-counter" aria-hidden="true">
          {String(current + 1).padStart(2, "0")} /{" "}
          {String(source.length).padStart(2, "0")}
        </span>
        {source.length > 1 && (
          <div className="gallery-controls">
            <button
              type="button"
              onClick={() => select(current - 1)}
              aria-label="Previous product view"
            >
              <Arrow className="arrow-back" />
            </button>
            <button
              type="button"
              onClick={() => select(current + 1)}
              aria-label="Next product view"
            >
              <Arrow />
            </button>
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-atomic="true">
        View {current + 1} of {source.length}
      </p>
      {source.length > 1 && (
        <p className="sr-only" id={instructionsId}>
          Use the left and right arrow keys to change views. Home shows the
          first view and End shows the last.
        </p>
      )}
      {source.length > 1 && (
        <div
          className="gallery-thumbnails"
          role="group"
          aria-label="Product views"
        >
          {source.map((image, i) => (
            <button
              key={image.id}
              ref={(element) => {
                thumbnails.current[i] = element;
              }}
              type="button"
              aria-label={`Show view ${i + 1}`}
              aria-pressed={i === current}
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
