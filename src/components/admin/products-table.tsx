"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { AdminProduct, AdminCategory } from "@/lib/admin/data";
import { formatPrice, getPrimaryImage } from "@/lib/product-utils";
import { productTransitions } from "@/lib/admin/validation";
import { productAction } from "@/app/admin/actions";
import { AdminEmpty, ImagePlaceholder, StatusBadge, adminDate } from "./ui";
import { ConfirmAction } from "./confirm-action";
import { ProductImageView } from "@/components/product-image";
import { imageCleanupAction } from "@/app/admin/image-actions";
export function ProductsTable({
  products,
  categories,
}: {
  products: AdminProduct[];
  categories: AdminCategory[];
}) {
  const [cleanup, cleanupAction, cleanupPending] = useActionState(
    imageCleanupAction,
    {},
  );
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

  return (
    <>
      <form
        action={cleanupAction}
        className="admin-image-cleanup"
        aria-busy={cleanupPending}
      >
        <button className="admin-text-button" disabled={cleanupPending}>
          {cleanupPending
            ? "Checking unused images..."
            : "Retry unused image cleanup"}
        </button>
        {cleanup.message && <p role="status">{cleanup.message}</p>}
        {cleanup.error && <p role="alert">{cleanup.error}</p>}
      </form>
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
          title={products.length ? "NO MATCHING RESULTS." : "NO PRODUCTS YET."}
          description={
            products.length
              ? "Try another search or change your filters."
              : "Add your first piece to the rack."
          }
          href={products.length ? undefined : "/admin/products/new"}
          label={products.length ? undefined : "ADD PRODUCT"}
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
                    {product.images?.length ? (
                      <ProductImageView
                        className="admin-product-thumbnail"
                        {...getPrimaryImage(product)}
                        width={48}
                        height={54}
                        sizes="48px"
                      />
                    ) : (
                      <ImagePlaceholder />
                    )}
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
                          <ConfirmAction
                            label={
                              product.featured
                                ? "Remove featured"
                                : "Feature product"
                            }
                            title={
                              product.featured
                                ? "REMOVE FEATURED STATUS?"
                                : "FEATURE PRODUCT?"
                            }
                            description={
                              product.name +
                              (product.featured
                                ? " will no longer be featured."
                                : " will be marked as featured.")
                            }
                            action={productAction}
                            fields={{
                              id: product.id,
                              operation: product.featured
                                ? "unfeature"
                                : "feature",
                            }}
                          />
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
