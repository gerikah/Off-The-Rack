import "server-only";
import { cache } from "react";
import { localProducts } from "./catalog";
import { getSupabase } from "./supabase";
import type { Product } from "./types";

export const getProducts = cache(async (): Promise<Product[]> => {
  if (process.env.NEXT_PUBLIC_CATALOG_SOURCE !== "supabase")
    return localProducts;
  const client = getSupabase();
  if (!client)
    throw new Error(
      "Supabase catalog selected but connection is not configured.",
    );
  const { data, error } = await client
    .from("products")
    .select("*, product_images(url, sort_order)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("The collection is temporarily unavailable.");
  return (data ?? []).map(({ product_images, ...product }) => ({
    ...product,
    images: (product_images as { url: string; sort_order: number }[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => i.url),
  })) as Product[];
});
export async function getProduct(slug: string) {
  return (await getProducts()).find((product) => product.slug === slug);
}
