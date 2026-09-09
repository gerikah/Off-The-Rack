import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getProducts } from "@/lib/products";
import { Arrow, Button } from "@/components/ui";
export const metadata: Metadata = { title: "The archive" };
export const revalidate = 60;
export default async function ArchivePage() {
  const products = (await getProducts()).filter(
    (p) => p.status !== "available",
  );
  return (
    <div className="archive-page">
      <div className="section-wrap">
        <div className="archive-heading">
          <span className="eyebrow">A RECORD OF WHAT CAME BEFORE / OTR</span>
          <h1 className="display">
            THE ARCHIVE<span>✳</span>
          </h1>
          <div>
            <p>Past pieces. Made once.</p>
            <span className="eyebrow">
              {String(products.length).padStart(2, "0")} PIECES / FOREVER ONE OF
              ONE
            </span>
          </div>
        </div>
        <div className="archive-grid">
          {products.map((product, i) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className={`archive-piece archive-piece-${i % 4}`}
            >
              <div
                className={`archive-image ${product.images[0]?.includes("feature") ? "" : "archive-composite"}`}
              >
                <Image
                  src={product.images[0] || "/images/background.webp"}
                  alt={product.image_alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 60vw"
                />
                <span className="archive-index">0{i + 1}</span>
                <span className="archive-sold">COLLECTED / SOLD</span>
              </div>
              <div className="archive-caption">
                <div>
                  <span className="eyebrow">{product.drop}</span>
                  <h2>{product.name}</h2>
                </div>
                <Arrow diagonal />
              </div>
            </Link>
          ))}
        </div>
        <div className="archive-end">
          <span className="eyebrow">THE STORY CONTINUES</span>
          <h2 className="display">
            THE NEXT PIECE
            <br />
            COULD BE YOURS.
          </h2>
          <Button href="/shop" className="button-light">
            Explore available pieces
          </Button>
        </div>
      </div>
    </div>
  );
}
