import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function Arrow({
  diagonal = false,
  className = "",
}: {
  diagonal?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`arrow ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {diagonal ? (
        <path d="M5 19 19 5M5 5h14v14" />
      ) : (
        <path d="M4 12h16m-6-6 6 6-6 6" />
      )}
    </svg>
  );
}
export function Button({
  href,
  children,
  secondary = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`button ${secondary ? "button-outline" : ""} ${className}`}
    >
      {children}
      <Arrow />
    </Link>
  );
}
export function SectionHeading({
  index,
  label,
  children,
}: {
  index: string;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <span className="eyebrow">
        <span className="index">{index}</span>
        {label}
      </span>
      {children}
    </div>
  );
}
export function EditorialImage({
  src,
  alt,
  className = "",
  priority = false,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`editorial-image ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 767px) 100vw, 70vw"
        preload={priority}
      />
      {children}
    </div>
  );
}
export function Marquee({ reverse = false }: { reverse?: boolean }) {
  const text = reverse
    ? "ONE OF ONE / HAND PAINTED / WEARABLE ART / NO REPEATS / "
    : "OFF THE RACK / OFF THE RACK / OFF THE RACK / OFF THE RACK / ";
  return (
    <div
      role="group"
      className={`marquee ${reverse ? "marquee-reverse" : ""}`}
      aria-label={
        reverse
          ? "One of one. Hand painted. Wearable art. No repeats."
          : "Off The Rack"
      }
    >
      <div className="marquee-track" aria-hidden="true">
        <span>{text}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="product-grid catalog-skeleton" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index}>
          <div className="skeleton-image" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line-short" />
        </div>
      ))}
    </div>
  );
}
