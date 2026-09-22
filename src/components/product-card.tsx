import { ProductImageView } from "./product-image";
import Link from "next/link";
import type { Product, ProductStatus as Status } from "@/lib/types";
import { formatPrice, getPrimaryImage } from "@/lib/product-utils";
import { Arrow } from "./ui";
import { SaveProductButton } from "./product-actions";

export function ProductStatus({ status }: { status: Status }) {
  return (
    <span
      className={`product-status ${status === "available" ? "is-available" : "is-sold"}`}
    >
      <i />
      {status === "available"
        ? "Available"
        : status === "sold"
          ? "Sold"
          : "Archived"}
    </span>
  );
}
export function ProductCard({
  product,
  number,
  className = "",
  eager = false,
}: {
  product: Product;
  number?: number;
  className?: string;
  eager?: boolean;
}) {
  const image = getPrimaryImage(product);
  const composite =
    image.src.startsWith("/images/") && !image.src.includes("feature-jacket");
  return (
    <article className={`product-card ${className}`}>
      <div className="product-card-visual">
        <Link
          href={`/product/${product.slug}`}
          className="product-image-link"
          aria-label={`View ${product.name}`}
        >
          <div
            className={`product-image ${composite ? "composite-image" : ""}`}
          >
            <ProductImageView
              src={image.src}
              alt={image.alt}
              fill
              loading={eager ? "eager" : "lazy"}
              sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>
          <span className="product-number">
            OTR—
            {number
              ? String(number).padStart(3, "0")
              : product.id.slice(0, 6).toUpperCase()}
          </span>
          {product.status !== "available" && (
            <span className="sold-tag">
              {product.status === "sold" ? "SOLD" : "ARCHIVED"}
            </span>
          )}
          <span className="product-open">
            <Arrow diagonal />
          </span>
        </Link>
        <SaveProductButton id={product.id} name={product.name} compact />
      </div>
      <div className="product-info">
        <div className="product-title-row">
          <h3>
            <Link href={`/product/${product.slug}`}>{product.name}</Link>
          </h3>
          <span>{formatPrice(product.price)}</span>
        </div>
        <div className="product-meta">
          <span>
            {[
              product.category?.name,
              product.size ? `Size ${product.size}` : null,
            ]
              .filter(Boolean)
              .join(" / ")}
          </span>
          <ProductStatus status={product.status} />
        </div>
      </div>
    </article>
  );
}
export function ProductGrid({
  products,
  className = "",
  eager = false,
}: {
  products: Product[];
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={`product-grid ${className}`}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          eager={eager && index < 2}
        />
      ))}
    </div>
  );
}
