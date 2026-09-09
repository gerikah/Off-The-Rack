"use client";
import Image from "next/image";
import { useState } from "react";
export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [selected, setSelected] = useState(0);
  const source = images.length ? images : ["/images/background.webp"];
  return (
    <div className="product-gallery">
      <div className="gallery-primary">
        <Image
          src={source[selected]}
          alt={`${alt} — view ${selected + 1}`}
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
              key={image}
              aria-label={`Show view ${i + 1}`}
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
            >
              <Image
                src={image}
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
