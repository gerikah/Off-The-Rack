import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/products";
import { formatPrice } from "@/lib/catalog";
import { ProductGallery } from "@/components/product-gallery";
import { ProductGrid, ProductStatus } from "@/components/product-card";
import { Button, SectionHeading } from "@/components/ui";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return {
    title: product?.name || "Piece not found",
    description: product?.description,
  };
}
export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const related = (await getProducts())
    .filter((p) => p.id !== product.id && p.status === "available")
    .sort(
      (a, b) =>
        Number(b.category === product.category) -
        Number(a.category === product.category),
    )
    .slice(0, 4);
  return (
    <div className="section-wrap product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/shop">Collection</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail">
        <ProductGallery images={product.images} alt={product.image_alt} />
        <div className="product-detail-info">
          <span className="eyebrow">
            {product.category.toUpperCase()} / {product.drop}
          </span>
          <h1 className="display">{product.name}</h1>
          <ProductStatus status={product.status} />
          <p className="detail-price">{formatPrice(product.price)}</p>
          <div className="piece-specs">
            <div>
              <span>Size</span>
              <strong>{product.size}</strong>
            </div>
            <div>
              <span>Color</span>
              <strong>{product.color}</strong>
            </div>
          </div>
          <p className="product-description">{product.description}</p>
          {product.status === "available" ? (
            <Button href={`/inquiry?product=${product.slug}`}>
              Inquire about this piece
            </Button>
          ) : (
            <>
              <p className="sold-note">
                This one has found its person. Find the piece that’s yours.
              </p>
              <Button href="/shop?status=available">
                View available pieces
              </Button>
            </>
          )}
          <p className="detail-note">
            One piece only. Availability confirmed on inquiry.
          </p>
          <div className="detail-accordions">
            <details open>
              <summary>
                Details<span>+</span>
              </summary>
              <dl>
                <dt>Condition</dt>
                <dd>{product.condition}</dd>
                <dt>Material</dt>
                <dd>{product.material}</dd>
                <dt>Finish</dt>
                <dd>Individually hand painted</dd>
              </dl>
            </details>
            <details>
              <summary>
                Measurements<span>+</span>
              </summary>
              <dl>
                {product.measurements.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{m.value}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Reworked garments can fit differently from the tag. Ask us for
                exact measurements before confirming your piece.
              </p>
            </details>
            <details>
              <summary>
                Care<span>+</span>
              </summary>
              <p>{product.care}</p>
            </details>
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
      <section className="related-section">
        <SectionHeading index="↗" label="KEEP EXPLORING" />
        <h2 className="display">YOU MAY ALSO LIKE.</h2>
        <ProductGrid products={related} />
      </section>
    </div>
  );
}
