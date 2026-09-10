import { getAdminCategories } from "@/lib/admin/data";
import { AdminHeading } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
export default async function NewProductPage() {
  const categories = await getAdminCategories();
  return (
    <>
      <AdminHeading
        title="Add product"
        description="Put a new piece on the rack."
      />
      <ProductForm categories={categories} />
    </>
  );
}
