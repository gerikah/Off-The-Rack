import Link from "next/link";
import { getDashboardStats } from "@/lib/admin/data";
import { AdminHeading } from "@/components/admin/ui";
import { InquiriesTable } from "@/components/admin/inquiries";
export default async function Dashboard() {
  const stats = await getDashboardStats();
  return (
    <>
      <AdminHeading
        title="Dashboard"
        description="A clear view of the rack, today."
      >
        <Link href="/admin/products/new" className="admin-button">
          + ADD PRODUCT
        </Link>
      </AdminHeading>
      <div className="admin-stats">
        {[
          ["Total products", stats.total, "/admin/products"],
          ["Available", stats.available, "/admin/products"],
          ["Sold / archived", stats.closed, "/admin/products"],
          ["Open inquiries", stats.openInquiries, "/admin/inquiries"],
        ].map(([label, count, href]) => (
          <Link key={label} href={String(href)} className="admin-stat">
            <span>{label}</span>
            <strong>{count}</strong>
            <small>View records &#8599;</small>
          </Link>
        ))}
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Recent inquiries</h2>
          <Link href="/admin/inquiries" className="admin-text-button">
            View all &#8599;
          </Link>
        </div>
        <InquiriesTable inquiries={stats.recent} compact />
      </section>
      <section className="admin-panel">
        <h2>Quick actions</h2>
        <div className="admin-quick-actions">
          <Link href="/admin/products/new">Add product &#8599;</Link>
          <Link href="/admin/products">View products &#8599;</Link>
          <Link href="/admin/inquiries">Open inquiries &#8599;</Link>
          <Link href="/admin/categories">Add category &#8599;</Link>
        </div>
      </section>
    </>
  );
}
