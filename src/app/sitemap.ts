import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/data/products";
import { siteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl;
  const products = await getProducts();
  return [
    ...["", "/shop", "/archive", "/about", "/contact"].map((route) => ({
      url: `${origin}${route}`,
      changeFrequency: "weekly" as const,
    })),
    ...products.map((p) => ({
      url: `${origin}/product/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "weekly" as const,
    })),
  ];
}
