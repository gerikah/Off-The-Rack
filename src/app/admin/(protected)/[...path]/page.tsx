import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
export default async function UnknownAdminPage() {
  await requireAdmin();
  notFound();
}
