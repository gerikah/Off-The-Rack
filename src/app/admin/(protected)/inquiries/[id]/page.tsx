import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminInquiryById } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/auth";
import { idSchema } from "@/lib/admin/validation";
import {
  AdminHeading,
  ImagePlaceholder,
  StatusBadge,
  adminDate,
} from "@/components/admin/ui";
import { InquiryStatusForm, CopyEmail } from "@/components/admin/inquiries";
export default async function InquiryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const inquiry = await getAdminInquiryById(id);
  if (!inquiry) notFound();
  const reference =
    inquiry.reference_url && /^https?:\/\//i.test(inquiry.reference_url)
      ? inquiry.reference_url
      : null;
  return (
    <>
      <AdminHeading
        title="Inquiry details"
        description={"Received " + adminDate(inquiry.created_at)}
      >
        <Link
          href="/admin/inquiries"
          className="admin-button admin-button-secondary"
        >
          Back to inquiries
        </Link>
      </AdminHeading>
      <div className="admin-form-layout">
        <div>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <h2>{inquiry.customer_name}</h2>
              <StatusBadge status={inquiry.status} />
            </div>
            <dl className="admin-detail-list">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={"mailto:" + inquiry.email}>{inquiry.email}</a>
                  <CopyEmail email={inquiry.email} />
                </dd>
              </div>
              {inquiry.mobile && (
                <div>
                  <dt>Mobile</dt>
                  <dd>{inquiry.mobile}</dd>
                </div>
              )}
              <div>
                <dt>Inquiry type</dt>
                <dd>{inquiry.inquiry_type}</dd>
              </div>
              <div>
                <dt>Created at</dt>
                <dd>
                  {new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila",
                  }).format(new Date(inquiry.created_at))}{" "}
                  (Philippines)
                </dd>
              </div>
            </dl>
          </section>
          {inquiry.product && (
            <section className="admin-panel">
              <h2>Selected product</h2>
              <div className="admin-selected-product">
                <ImagePlaceholder />
                <div>
                  <h3>{inquiry.product.name}</h3>
                  <StatusBadge status={inquiry.product.status} />
                  <div className="admin-row-actions">
                    <Link
                      href={"/admin/products/" + inquiry.product.id + "/edit"}
                    >
                      Edit product
                    </Link>
                    <Link href={"/product/" + inquiry.product.slug}>
                      View storefront piece &#8599;
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}
          {inquiry.inquiry_type === "product" && !inquiry.product && (
            <section className="admin-panel">
              <h2>Selected product</h2>
              <p>The linked product is no longer available.</p>
            </section>
          )}
          {inquiry.inquiry_type === "custom" && (
            <section className="admin-panel">
              <h2>Custom piece</h2>
              <dl className="admin-detail-list">
                {[
                  ["Garment type", inquiry.garment_type],
                  ["Preferred size", inquiry.preferred_size],
                  ["Design idea", inquiry.design_idea],
                ].map(
                  ([label, value]) =>
                    value && (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd className="admin-preserve-lines">{value}</dd>
                      </div>
                    ),
                )}
                {reference && (
                  <div>
                    <dt>Reference</dt>
                    <dd>
                      <a
                        href={reference}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open reference &#8599;
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
          <section className="admin-panel">
            <h2>Message</h2>
            <p className="admin-preserve-lines">{inquiry.message}</p>
          </section>
        </div>
        <section className="admin-panel admin-sticky-panel">
          <h2>Manage inquiry</h2>
          <InquiryStatusForm id={inquiry.id} status={inquiry.status} />
        </section>
      </div>
    </>
  );
}
