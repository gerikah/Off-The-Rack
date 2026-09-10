import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/data/products";
import { formatPrice } from "@/lib/product-utils";
import { ProductGallery } from "@/components/product-gallery";
import { ProductGrid, ProductStatus } from "@/components/product-card";
import { Button, SectionHeading } from "@/components/ui";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return {
    title: product?.name || "Piece not found",
    description:
      product?.short_description || product?.description || undefined,
  };
}
export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product);
  return (
    <div className="section-wrap product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/shop">Collection</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail">
        <ProductGallery images={product.images} alt={product.name} />
        <div className="product-detail-info">
          <span className="eyebrow">
            {product.category?.name.toUpperCase()}
          </span>
          <h1 className="display">{product.name}</h1>
          <ProductStatus status={product.status} />
          <p className="detail-price">{formatPrice(product.price)}</p>
          <div className="piece-specs">
            {product.size && (
              <div>
                <span>Size</span>
                <strong>{product.size}</strong>
              </div>
            )}
            {product.color && (
              <div>
                <span>Color</span>
                <strong>{product.color}</strong>
              </div>
            )}
          </div>
          {product.short_description && (
            <p className="product-description">{product.short_description}</p>
          )}
          {product.description && (
            <p className="product-description">{product.description}</p>
          )}
          {product.status === "available" ? (
            <Button href={`/inquiry?product=${product.slug}`}>
              Inquire about this piece
            </Button>
          ) : (
            <>
              <p className="sold-note">
                This one has found its person. Find the piece that’s yours.
              </p>
              <Button href="/shop?status=available">View similar pieces</Button>
            </>
          )}
          <p className="detail-note">
            One piece only. Availability confirmed on inquiry.
          </p>
          <div className="detail-accordions">
            {(product.condition || product.material) && (
              <details open>
                <summary>
                  Details<span>+</span>
                </summary>
                <dl>
                  {product.condition && (
                    <>
                      <dt>Condition</dt>
                      <dd>{product.condition}</dd>
                    </>
                  )}
                  {product.material && (
                    <>
                      <dt>Material</dt>
                      <dd>{product.material}</dd>
                    </>
                  )}
                </dl>
              </details>
            )}
            {product.measurements && (
              <details>
                <summary>
                  Measurements<span>+</span>
                </summary>
                <p className="preserve-lines">{product.measurements}</p>
                <p>
                  Reworked garments can fit differently from the tag. Ask us for
                  exact measurements before confirming your piece.
                </p>
              </details>
            )}
            {product.care_instructions && (
              <details>
                <summary>
                  Care<span>+</span>
                </summary>
                <p className="preserve-lines">{product.care_instructions}</p>
              </details>
            )}
            <details>
              <summary>
                Delivery / meetup<span>+</span>
              </summary>
              <p>
                We’ll confirm shipping options, delivery fees, payment, and any
                available meetup arrangements with you directly. An inquiry does
                not reserve the piece.
              </p>
            </details>
            <details>
              <summary>
                Customization<span>+</span>
              </summary>
              <p>
                Have something in mind? We can explore your idea, garment, and
                artwork together.
              </p>
              <Link className="text-link" href="/inquiry?type=custom">
                Start a custom inquiry ↗
              </Link>
            </details>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="related-section">
          <SectionHeading index="↗" label="KEEP EXPLORING" />
          <h2 className="display">YOU MAY ALSO LIKE.</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
