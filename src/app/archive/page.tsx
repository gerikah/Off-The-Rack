import type { Metadata } from "next";
import { getArchivedProducts } from "@/lib/data/products";
import { ProductCard } from "@/components/product-card";
import { Button, SectionHeading } from "@/components/ui";
export const metadata: Metadata = { title: "The archive" };
export const dynamic = "force-dynamic";
export default async function ArchivePage() {
  const products = await getArchivedProducts();
  return (
    <section className="section-wrap archive-page">
      <SectionHeading index="01" label="OFF THE RACK / PAST PIECES" />
      <div className="page-heading">
        <div>
          <h1 className="display">
            THE ARCHIVE<span className="heading-dot">.</span>
          </h1>
          <p>
            One-of-one originals. A record of pieces and the stories they carry.
          </p>
        </div>
      </div>
      {products.length ? (
        <div className="archive-editorial">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} number={i + 1} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2 className="display">THE ARCHIVE IS JUST GETTING STARTED.</h2>
          <p>Past pieces will find their place here.</p>
          <Button href="/shop">Explore the collection</Button>
        </div>
      )}
    </section>
  );
}
