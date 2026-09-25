import "server-only";
import { cache } from "react";
import { getSupabase } from "../supabase";
import type { Product, ProductStatus } from "../types";
import { selectPrimaryImage } from "../product-utils";
import { logDataError } from "./errors";
const selection =
  "id,name,slug,short_description,description,price,category_id,size,condition,material,color,measurements,care_instructions,status,featured,bestseller,created_at,updated_at,category:categories(id,name,slug,description,created_at,updated_at),images:product_images(id,product_id,image_url,storage_path,alt_text,sort_order,is_primary,created_at)";
type Filters = {
  statuses?: ProductStatus[];
  bestseller?: boolean;
  slug?: string;
  categoryId?: string;
  excludeId?: string;
  limit?: number;
};
async function queryProducts(filters: Filters = {}): Promise<Product[]> {
  if (filters.limit !== undefined && filters.limit <= 0) return [];
  const client = getSupabase();
  const products: Product[] = [];
  // Page through PostgREST's row limit so Shop sees the full catalog.
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = client
      .from("products")
      .select(selection)
      .order("created_at", { ascending: false })
      .order("id")
      .order("sort_order", { referencedTable: "images", ascending: true });
    if (filters.statuses) query = query.in("status", filters.statuses);
    if (filters.bestseller) query = query.eq("bestseller", true);
    if (filters.slug) query = query.eq("slug", filters.slug);
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.excludeId) query = query.neq("id", filters.excludeId);
    const size = Math.min(
      pageSize,
      (filters.limit ?? Infinity) - products.length,
    );
    const { data, error } = await query.range(offset, offset + size - 1);
    if (error) {
      logDataError("read products", error);
      throw new Error("The collection is temporarily unavailable.");
    }
    const page = (data ?? []).map((product) => ({
      ...product,
      images: [...product.images].sort((a, b) => a.sort_order - b.sort_order),
    }));
    products.push(...page);
    if (process.env.NODE_ENV !== "production") {
      for (const product of page) {
        const selected = selectPrimaryImage(product.images);
        console.info("[product-images] product_image_read", {
          productId: product.id,
          imageCount: product.images.length,
          primaryCount: product.images.filter((image) => image.is_primary)
            .length,
          selectedImageSource: selected
            ? selected.storage_path
              ? "storage_path"
              : "image_url"
            : "fallback",
        });
      }
    }
    if (!data || data.length < size || products.length === filters.limit) break;
  }
  return products;
}
export const getProducts = cache(() => queryProducts());
export const getAvailableProducts = cache(() =>
  queryProducts({ statuses: ["available"] }),
);
export const getNewArrivals = cache((limit = 3) =>
  queryProducts({ statuses: ["available"], limit }),
);
export const getBestsellers = cache((limit = 5) =>
  queryProducts({ statuses: ["available", "sold"], bestseller: true, limit }),
);
export const getArchivedProducts = cache(() =>
  queryProducts({ statuses: ["sold", "archived"] }),
);
export const getProductBySlug = cache(async (slug: string) =>
  typeof slug === "string" &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
  slug.length <= 160
    ? (await queryProducts({ slug, limit: 1 }))[0]
    : undefined,
);
export const getRelatedProducts = cache(async (product: Product, limit = 4) => {
  const sameCategory = product.category_id
    ? await queryProducts({
        statuses: ["available"],
        categoryId: product.category_id,
        excludeId: product.id,
        limit,
      })
    : [];
  if (sameCategory.length === limit) return sameCategory;
  const others = await queryProducts({
    statuses: ["available"],
    excludeId: product.id,
    limit: limit * 2,
  });
  return [
    ...sameCategory,
    ...others.filter(
      (other) => !sameCategory.some((item) => item.id === other.id),
    ),
  ].slice(0, limit);
});
