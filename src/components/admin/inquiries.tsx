"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { AdminInquiry } from "@/lib/admin/data";
import { inquiryStatusAction } from "@/app/admin/actions";
import { AdminEmpty, StatusBadge, adminDate } from "./ui";
export function InquiriesTable({
  inquiries,
  compact = false,
}: {
  inquiries: AdminInquiry[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const filtered = inquiries.filter(
    (item) =>
      (!status || item.status === status) &&
      (item.customer_name + " " + item.email + " " + (item.product?.name || ""))
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  if (!inquiries.length)
    return (
      <AdminEmpty
        title="NO INQUIRIES YET."
        description="Customer conversations will appear here."
      />
    );
  return (
    <>
      {!compact && (
        <div className="admin-filters">
          <label>
            Search inquiries
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Customer, email or product"
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {["new", "read", "replied", "resolved"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {!filtered.length ? (
        <AdminEmpty title="NO MATCHING RESULTS." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Product</th>
                {!compact && <th scope="col">Type</th>}
                <th scope="col">Status</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td data-label="Customer">
                    <Link
                      href={"/admin/inquiries/" + item.id}
                      className="admin-record-link"
                    >
                      {item.customer_name}
                    </Link>
                    <small>{item.email}</small>
                  </td>
                  <td data-label="Product">
                    {item.product?.name ||
                      (item.inquiry_type === "custom"
                        ? "Custom piece"
                        : "General inquiry")}
                  </td>
                  {!compact && <td data-label="Type">{item.inquiry_type}</td>}
                  <td data-label="Status">
                    <StatusBadge status={item.status} />
                  </td>
                  <td data-label="Date">{adminDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
export function InquiryStatusForm({
  id,
  status,
}: {
  id: string;
  status: AdminInquiry["status"];
}) {
  const [state, action, pending] = useActionState(inquiryStatusAction, {});
  return (
    <form action={action} className="admin-form" aria-busy={pending}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor="inquiry-status">
        Inquiry status
        <select
          key={status}
          id="inquiry-status"
          name="status"
          defaultValue={status}
          disabled={pending}
        >
          {["new", "read", "replied", "resolved"].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button className="admin-button" disabled={pending}>
        {pending ? "UPDATING STATUS..." : "UPDATE STATUS"}
      </button>
      <div className="admin-inquiry-actions">
        {["read", "replied", "resolved"].map((next) => (
          <button
            key={next}
            type="submit"
            name="next_status"
            value={next}
            className="admin-button admin-button-secondary"
            disabled={pending || status === next}
          >
            MARK AS {next.toUpperCase()}
          </button>
        ))}
      </div>
      {state.error && (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="admin-success" role="status">
          {state.message}
        </p>
      )}
      <p className="admin-help">
        Opening this inquiry does not change its status. Mark it read, replied
        or resolved when ready.
      </p>
    </form>
  );
}
export function CopyEmail({ email }: { email: string }) {
  const [feedback, setFeedback] = useState("");
  return (
    <div className="admin-copy">
      <button
        type="button"
        className="admin-text-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            setFeedback("Email copied.");
          } catch {
            setFeedback(
              "Copy unavailable. Select the email address to copy it.",
            );
          }
        }}
      >
        Copy email
      </button>
      <span role="status">{feedback}</span>
    </div>
  );
}
