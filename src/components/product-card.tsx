import Image from "next/image";
import Link from "next/link";
import type { Product, ProductStatus as Status } from "@/lib/types";
import { formatPrice } from "@/lib/catalog";
import { Arrow } from "./ui";

export function ProductStatus({ status }: { status: Status }) {
  return (
    <span
      className={`product-status ${status === "available" ? "is-available" : "is-sold"}`}
    >
      <i />
      {status === "available" ? "Available" : "Sold / archive"}
    </span>
  );
}
export function ProductCard({
  product,
  number,
  className = "",
}: {
  product: Product;
  number?: number;
  className?: string;
}) {
  const composite = !product.images[0]?.includes("feature-jacket");
  return (
    <article className={`product-card ${className}`}>
      <Link
        href={`/product/${product.slug}`}
        className="product-image-link"
        aria-label={`View ${product.name}`}
      >
        <div className={`product-image ${composite ? "composite-image" : ""}`}>
          <Image
            src={product.images[0] || "/images/background.webp"}
            alt={product.image_alt}
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>
        <span className="product-number">
          OTR—{String(number ?? Number(product.id.slice(-3))).padStart(3, "0")}
        </span>
        {product.status !== "available" && (
          <span className="sold-tag">SOLD</span>
        )}
        <span className="product-open">
          <Arrow diagonal />
        </span>
      </Link>
      <div className="product-info">
        <div className="product-title-row">
          <h3>
            <Link href={`/product/${product.slug}`}>{product.name}</Link>
          </h3>
          <span>{formatPrice(product.price)}</span>
        </div>
        <div className="product-meta">
          <span>
            {product.category} / Size {product.size}
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
}: {
  products: Product[];
  className?: string;
}) {
  return (
    <div className={`product-grid ${className}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
