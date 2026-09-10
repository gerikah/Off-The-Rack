import { getAdminCategories } from "@/lib/admin/data";
import { CategoriesManager } from "@/components/admin/categories";
export default async function CategoriesPage() {
  return <CategoriesManager categories={await getAdminCategories()} />;
}
