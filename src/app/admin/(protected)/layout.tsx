import { requireAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/shell";
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();
  return <AdminShell email={user.email || "Admin"}>{children}</AdminShell>;
}
