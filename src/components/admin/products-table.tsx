"use client";
import Link from "next/link";
import { useState } from "react";
import type { AdminProduct, AdminCategory } from "@/lib/admin/data";
import { formatPrice } from "@/lib/product-utils";
import { productTransitions } from "@/lib/admin/validation";
import { productAction } from "@/app/admin/actions";
import { AdminEmpty, ImagePlaceholder, StatusBadge, adminDate } from "./ui";
import { ConfirmAction } from "./confirm-action";
export function ProductsTable({
  products,
  categories,
}: {
  products: AdminProduct[];
  categories: AdminCategory[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const filtered = products.filter(
    (product) =>
      (!category || product.category_id === category) &&
      (!status || product.status === status) &&
      (product.name + " " + product.slug)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  if (!products.length)
    return (
      <AdminEmpty
        title="NO PRODUCTS YET."
        description="Add your first piece to the rack."
        href="/admin/products/new"
        label="ADD PRODUCT"
      />
    );
  return (
    <>
      <div className="admin-filters">
        <label>
          Search products
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or slug"
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["available", "sold", "archived"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="admin-result-count" role="status">
        {filtered.length} products
      </p>
      {!filtered.length ? (
        <AdminEmpty
          title="NO MATCHING RESULTS."
          description="Try another search or change your filters."
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  "Image",
                  "Product",
                  "Category",
                  "Price",
                  "Status",
                  "Updated",
                  "Actions",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td data-label="Image">
                    <ImagePlaceholder />
                  </td>
                  <td data-label="Product">
                    <Link
                      className="admin-record-link"
                      href={"/admin/products/" + product.id + "/edit"}
                    >
                      {product.name}
                    </Link>
                    <small>{product.slug}</small>
                  </td>
                  <td data-label="Category">
                    {product.category?.name || "Uncategorized"}
                  </td>
                  <td data-label="Price">{formatPrice(product.price)}</td>
                  <td data-label="Status">
                    <StatusBadge status={product.status} />
                  </td>
                  <td data-label="Updated">{adminDate(product.updated_at)}</td>
                  <td data-label="Actions">
                    <div className="admin-row-actions">
                      <Link href={"/admin/products/" + product.id + "/edit"}>
                        Edit
                      </Link>
                      <details className="admin-actions-menu">
                        <summary aria-label={"Actions for " + product.name}>
                          More <span aria-hidden="true">&#8943;</span>
                        </summary>
                        <div>
                          {productTransitions[product.status].map((next) => (
                            <ConfirmAction
                              key={next}
                              label={
                                next === "sold"
                                  ? "Mark sold"
                                  : next === "archived"
                                    ? "Archive"
                                    : "Restore to available"
                              }
                              title={
                                next === "sold"
                                  ? "MARK PRODUCT SOLD?"
                                  : next === "archived"
                                    ? "ARCHIVE PRODUCT?"
                                    : "RESTORE PRODUCT?"
                              }
                              description={
                                product.name + " will be marked " + next + "."
                              }
                              action={productAction}
                              fields={{ id: product.id, operation: next }}
                            />
                          ))}
                          <ConfirmAction
                            label="Delete"
                            title="DELETE PRODUCT?"
                            description={
                              "This permanently removes " +
                              product.name +
                              ". Products with related inquiries must be archived instead."
                            }
                            danger
                            action={productAction}
                            fields={{ id: product.id, operation: "delete" }}
                          />
                        </div>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
