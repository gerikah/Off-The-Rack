import Image from "next/image";
import type { Metadata } from "next";
import { getProduct } from "@/lib/products";
import { InquiryForm } from "@/components/inquiry-form";
import { BrandStar } from "@/components/ui";
export const metadata: Metadata = {
  title: "Send an inquiry",
  robots: { index: false, follow: true },
};
export default async function InquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; type?: string }>;
}) {
  const params = await searchParams;
  const product = params.product ? await getProduct(params.product) : undefined;
  const type =
    params.type === "custom" ? "custom" : product ? "product" : "general";
  const connected = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return (
    <section className="inquiry-page">
      <Image
        className="inquiry-background"
        src="/images/13.webp"
        alt="Hand-painted silver artwork on a black denim jacket"
        fill
        preload
        sizes="100vw"
      />
      <div className="inquiry-composition">
        <div className="inquiry-copy">
          <span className="eyebrow">OFF THE RACK / LET’S TALK</span>
          <h1 className="display">
            YOUR NEXT
            <br />
            PIECE STARTS
            <br />
            <span className="chrome">HERE.</span>
          </h1>
          <BrandStar />
          <p>
            Something caught your eye.
            <br />
            Or something’s on your mind.
            <br />
            Let’s make it yours.
          </p>
          <span className="eyebrow">
            INDIVIDUAL PIECES. PERSONAL CONVERSATIONS.
          </span>
        </div>
        <InquiryForm
          product={product}
          initialType={type}
          connected={connected}
        />
      </div>
    </section>
  );
}
