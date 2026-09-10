import { notFound } from "next/navigation";
import { getAdminProductById, getAdminCategories } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/auth";
import { idSchema } from "@/lib/admin/validation";
import { AdminHeading } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [product, categories] = await Promise.all([
    getAdminProductById(id),
    getAdminCategories(),
  ]);
  if (!product) notFound();
  return (
    <>
      <AdminHeading title="Edit product" description={product.name} />
      <ProductForm key={product.id} product={product} categories={categories} />
    </>
  );
}
