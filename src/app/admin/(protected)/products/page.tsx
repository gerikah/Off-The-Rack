import Link from "next/link";
import { getAdminProducts, getAdminCategories } from "@/lib/admin/data";
import { ProductsTable } from "@/components/admin/products-table";
import { AdminHeading } from "@/components/admin/ui";
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [products, categories, params] = await Promise.all([
    getAdminProducts(),
    getAdminCategories(),
    searchParams,
  ]);
  return (
    <>
      <AdminHeading
        title="Products"
        description="Manage every piece, from new arrival to archive."
      >
        <Link href="/admin/products/new" className="admin-button">
          + ADD PRODUCT
        </Link>
      </AdminHeading>
      {(params.notice === "added" || params.notice === "updated") && (
        <p className="admin-success" role="status">
          {params.notice === "added" ? "PRODUCT ADDED." : "PRODUCT UPDATED."}
        </p>
      )}
      <ProductsTable products={products} categories={categories} />
    </>
  );
}
