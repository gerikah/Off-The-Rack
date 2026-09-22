import { notFound } from "next/navigation";
import { getAdminProductById, getAdminCategories } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/auth";
import { idSchema } from "@/lib/admin/validation";
import { AdminHeading } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [product, categories] = await Promise.all([
    getAdminProductById(id),
    getAdminCategories(),
  ]);
  if (!product) notFound();
  const { notice } = await searchParams;
  return (
    <>
      <AdminHeading title="Edit product" description={product.name} />
      {notice === "added" && (
        <p className="admin-success" role="status">
          PRODUCT ADDED. Add your photos below.
        </p>
      )}
      <ProductForm key={product.id} product={product} categories={categories} />
    </>
  );
}
