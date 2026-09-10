import { getAdminInquiries } from "@/lib/admin/data";
import { AdminHeading } from "@/components/admin/ui";
import { InquiriesTable } from "@/components/admin/inquiries";
export default async function InquiriesPage() {
  const inquiries = await getAdminInquiries();
  return (
    <>
      <AdminHeading
        title="Inquiries"
        description="Keep customer conversations moving."
      />
      <InquiriesTable inquiries={inquiries} />
    </>
  );
}
