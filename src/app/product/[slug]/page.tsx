import type { Metadata } from "next";
import { publicMetadata, siteUrl } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
import { ProductActions } from "@/components/product-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/data/products";
import { formatPrice, getPrimaryImage } from "@/lib/product-utils";
import { ProductGallery } from "@/components/product-gallery";
import { Arrow } from "@/components/ui";
import { brand } from "@/lib/brand";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Piece not found", robots: { index: false } };
  return publicMetadata(
    product.name,
    (
      product.short_description ||
      product.description ||
      `Explore ${product.name}, a one-of-one Off The Rack piece. Availability is confirmed by inquiry.`
    ).slice(0, 200),
    `/product/${product.slug}`,
    getPrimaryImage(product).src,
  );
}
export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const buyHref = `mailto:${brand.email}?subject=${encodeURIComponent(
    `I'd like to buy ${product.name}`,
  )}&body=${encodeURIComponent(
    `Hi Off The Rack,\n\nI'd like to buy ${product.name} (${formatPrice(product.price)}).\n${siteUrl}/product/${product.slug}\n\nPlease confirm availability, payment and delivery details. Thank you!`,
  )}`;
  const statusLabel =
    product.status === "available"
      ? "Available"
      : product.status === "sold"
        ? "Sold"
        : "Archived";
  return (
    <div className="section-wrap product-page">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Product",
              name: product.name,
              description:
                product.short_description || product.description || undefined,
              image: [new URL(getPrimaryImage(product).src, siteUrl).href],
              sku: product.id,
              url: `${siteUrl}/product/${product.slug}`,
              brand: { "@type": "Brand", name: "Off The Rack" },
              ...(product.status !== "archived"
                ? {
                    offers: {
                      "@type": "Offer",
                      url: `${siteUrl}/product/${product.slug}`,
                      priceCurrency: "PHP",
                      price: product.price,
                      availability:
                        product.status === "available"
                          ? "https://schema.org/InStock"
                          : "https://schema.org/SoldOut",
                    },
                  }
                : {}),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: siteUrl,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Collection",
                  item: `${siteUrl}/shop`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: product.name,
                  item: `${siteUrl}/product/${product.slug}`,
                },
              ],
            },
          ],
        }}
      />
      <div className="product-detail">
        <div className="product-detail-gallery-column">
          <ProductGallery images={product.images} alt={product.name} />
        </div>
        <div className="product-detail-info">
          <h1 className="display">{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <p className="product-description preserve-lines">
            {product.description ||
              product.short_description ||
              "Contact the shop for more details about this piece."}
          </p>
          <ProductActions
            id={product.id}
            name={product.name}
            slug={product.slug}
            buyHref={product.status === "available" ? buyHref : undefined}
            unavailableLabel={statusLabel}
          />
          <dl className="product-facts">
            <div>
              <dt>Size</dt>
              <dd>{product.size || "Ask the shop"}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{product.condition || "Ask the shop"}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{statusLabel}</dd>
            </div>
          </dl>
          <section className="product-care" aria-label="Care instructions">
            <h2>Care instructions</h2>
            <p className="preserve-lines">
              {product.care_instructions ||
                "Ask the shop for care instructions specific to this piece."}
            </p>
          </section>
          <Link className="product-similar-link" href="/shop?status=available">
            View similar products <Arrow diagonal />
          </Link>
        </div>
      </div>
    </div>
  );
}
