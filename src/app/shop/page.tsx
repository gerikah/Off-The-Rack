import Image from "next/image";
import type { Metadata } from "next";
import { getProducts } from "@/lib/products";
import { ShopCatalog } from "@/components/shop-catalog";

export const metadata: Metadata = { title: "Shop the collection" };
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; search?: string; status?: string }>;
}) {
  const [products, params] = await Promise.all([getProducts(), searchParams]);
  return (
    <div className="shop-surface">
      <div className="section-wrap shop-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">THE COLLECTION / OFF THE RACK</span>
            <h1 className="display">
              FIND YOUR
              <br />
              ONE OF ONE<span className="heading-dot">.</span>
            </h1>
            <p>One-of-one pieces, available until they’re gone.</p>
          </div>
          <Image
            className="shop-wordmark"
            src="/images/off-the-rack-logo.webp"
            alt="Off The Rack"
            width={360}
            height={230}
            preload
          />
        </div>
        <ShopCatalog
          key={JSON.stringify(params)}
          products={products}
          initialQuery={params.q}
          focusSearch={params.search === "1"}
          initialStatus={params.status}
        />
      </div>
    </div>
  );
}
