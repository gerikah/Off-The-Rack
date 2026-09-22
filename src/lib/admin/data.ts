import "server-only";
import { requireAdmin } from "./auth";
import { cleanupProductImageFiles } from "./images";
import { AdminError, databaseError } from "./errors";
import {
  productSchema,
  categorySchema,
  idSchema,
  productStatusSchema,
  inquiryStatusSchema,
  productTransitions,
} from "./validation";
import type { ProductRow, ProductImage, Category, Inquiry } from "@/lib/types";
export type AdminProduct = ProductRow & {
  category: Category | null;
  images: ProductImage[];
};
export type AdminCategory = Category & { productCount: number };
export type AdminInquiry = Inquiry & {
  product: Pick<ProductRow, "id" | "name" | "slug" | "status"> | null;
};
const productSelect = "*, category:categories(*), images:product_images(*)";
const inquirySelect = "*, product:products(id,name,slug,status)";
export async function getAdminProducts(): Promise<AdminProduct[]> {
  const { client } = await requireAdmin();
  const result: AdminProduct[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("products")
      .select(productSelect)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error) databaseError("read admin products", error);
    result.push(...data);
    if (data.length < 500) return result;
  }
}
export async function getAdminProductById(
  id: string,
): Promise<AdminProduct | null> {
  const { client } = await requireAdmin();
  idSchema.parse(id);
  const { data, error } = await client
    .from("products")
    .select(productSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) databaseError("read admin product", error);
  return data;
}
export async function getAdminCategories(): Promise<AdminCategory[]> {
  const { client } = await requireAdmin();
  const result: AdminCategory[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("categories")
      .select("*, products(count)")
      .order("name")
      .order("id")
      .range(offset, offset + 499);
    if (error) databaseError("read admin categories", error);
    result.push(
      ...data.map(({ products, ...category }) => ({
        ...category,
        productCount: products[0]?.count || 0,
      })),
    );
    if (data.length < 500) return result;
  }
}
async function saveProduct(input: unknown, id?: string) {
  const { client } = await requireAdmin();
  if (id) idSchema.parse(id);
  const payload = productSchema.parse(input);
  let duplicate = client.from("products").select("id").eq("slug", payload.slug);
  if (id) duplicate = duplicate.neq("id", id);
  const [slugCheck, category] = await Promise.all([
    duplicate.maybeSingle(),
    client
      .from("categories")
      .select("id")
      .eq("id", payload.category_id)
      .maybeSingle(),
  ]);
  if (slugCheck.error) databaseError("check product slug", slugCheck.error);
  if (slugCheck.data) throw new AdminError("This slug is already in use.");
  if (category.error) databaseError("check category", category.error);
  if (!category.data) throw new AdminError("Choose an existing category.");
  const query = id
    ? client
        .from("products")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
    : client.from("products").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) databaseError("save product", error);
  return data.id;
}
export async function createProduct(input: unknown) {
  return saveProduct(input);
}
export async function updateProduct(id: string, input: unknown) {
  return saveProduct(input, id);
}
export async function updateProductStatus(id: string, status: unknown) {
  const { client } = await requireAdmin();
  idSchema.parse(id);
  const next = productStatusSchema.parse(status);
  const current = await getAdminProductById(id);
  if (!current) throw new AdminError("This product no longer exists.");
  const allowed: readonly string[] = productTransitions[current.status];
  if (!allowed.includes(next))
    throw new AdminError(
      "This status change is no longer available. Refresh and try again.",
    );
  const { data, error } = await client
    .from("products")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", current.status)
    .select("id")
    .maybeSingle();
  if (error) databaseError("change product status", error);
  if (!data)
    throw new AdminError("This product changed. Refresh and try again.");
}
export async function deleteProduct(id: string) {
  const { client } = await requireAdmin();
  idSchema.parse(id);
  const current = await getAdminProductById(id);
  const { error } = await client.rpc("otr_delete_product", {
    product_uuid: id,
  });
  if (error?.code === "23503")
    throw new AdminError(
      "This product has related inquiries or records. Archive it to preserve its history.",
    );
  if (error) databaseError("delete product", error);
  return cleanupProductImageFiles(
    client,
    current?.images.map((image) => image.storage_path) || [],
  );
}
async function saveCategory(input: unknown, id?: string) {
  const { client } = await requireAdmin();
  if (id) idSchema.parse(id);
  const payload = categorySchema.parse(input);
  let duplicate = client
    .from("categories")
    .select("id")
    .eq("slug", payload.slug);
  if (id) duplicate = duplicate.neq("id", id);
  const check = await duplicate.maybeSingle();
  if (check.error) databaseError("check category slug", check.error);
  if (check.data) throw new AdminError("This slug is already in use.");
  const query = id
    ? client
        .from("categories")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
    : client.from("categories").insert(payload);
  const { error } = await query.select("id").single();
  if (error) databaseError("save category", error);
}
export async function createCategory(input: unknown) {
  return saveCategory(input);
}
export async function updateCategory(id: string, input: unknown) {
  return saveCategory(input, id);
}
export async function deleteCategory(id: string) {
  const { client } = await requireAdmin();
  idSchema.parse(id);
  // Existing ON DELETE SET NULL keeps product records; the UI confirms this effect.
  const { data, error } = await client
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) databaseError("delete category", error);
  if (!data) throw new AdminError("This category no longer exists.");
}
export async function getAdminInquiries(): Promise<AdminInquiry[]> {
  const { client } = await requireAdmin();
  const result: AdminInquiry[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("inquiries")
      .select(inquirySelect)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error) databaseError("read admin inquiries", error);
    result.push(...data);
    if (data.length < 500) return result;
  }
}
export async function getAdminInquiryById(
  id: string,
): Promise<AdminInquiry | null> {
  const { client } = await requireAdmin();
  idSchema.parse(id);
  const { data, error } = await client
    .from("inquiries")
    .select(inquirySelect)
    .eq("id", id)
    .maybeSingle();
  if (error) databaseError("read inquiry", error);
  return data;
}
export async function updateInquiryStatus(id: string, status: unknown) {
  const { client } = await requireAdmin();
  idSchema.parse(id);
  const next = inquiryStatusSchema.parse(status);
  const { data, error } = await client
    .from("inquiries")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) databaseError("update inquiry", error);
  if (!data) throw new AdminError("This inquiry no longer exists.");
}
export async function getDashboardStats() {
  const { client } = await requireAdmin();
  const results = await Promise.all([
    client.from("products").select("id", { head: true, count: "exact" }),
    client
      .from("products")
      .select("id", { head: true, count: "exact" })
      .eq("status", "available"),
    client
      .from("products")
      .select("id", { head: true, count: "exact" })
      .in("status", ["sold", "archived"]),
    client
      .from("inquiries")
      .select("id", { head: true, count: "exact" })
      .neq("status", "resolved"),
    client
      .from("inquiries")
      .select(inquirySelect)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  for (const result of results)
    if (result.error) databaseError("read dashboard", result.error);
  return {
    total: results[0].count || 0,
    available: results[1].count || 0,
    closed: results[2].count || 0,
    openInquiries: results[3].count || 0,
    recent: results[4].data || [],
  };
}

export async function updateProductFeatured(id: string, featured: boolean) {
  const { client } = await requireAdmin();
  idSchema.parse(id);
  const { data, error } = await client
    .from("products")
    .update({ featured, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) databaseError("change featured product", error);
  if (!data) throw new AdminError("This product no longer exists.");
}
