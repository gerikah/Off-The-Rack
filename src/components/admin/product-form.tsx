"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { Category, ProductRow } from "@/lib/types";
import { saveProductAction } from "@/app/admin/actions";
import { slugify } from "@/lib/admin/validation";
import { ImagePlaceholder } from "./ui";
export function ProductForm({
  product,
  categories,
}: {
  product?: ProductRow;
  categories: Category[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, {});
  const [values, setValues] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    category_id: product?.category_id || "",
    price: product ? String(product.price) : "",
    short_description: product?.short_description || "",
    description: product?.description || "",
    size: product?.size || "",
    condition: product?.condition || "",
    material: product?.material || "",
    color: product?.color || "",
    measurements: product?.measurements || "",
    care_instructions: product?.care_instructions || "",
    status: product?.status || "available",
    featured: product?.featured || false,
    bestseller: product?.bestseller || false,
  });
  const [manualSlug, setManualSlug] = useState(!!product);
  type TextField = Exclude<keyof typeof values, "featured" | "bestseller">;
  function change(name: TextField, value: string) {
    setValues((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "name" && !manualSlug ? { slug: slugify(value) } : {}),
    }));
    if (name === "slug") setManualSlug(true);
  }
  function field(
    name: TextField,
    label: string,
    options: {
      required?: boolean;
      long?: boolean;
      type?: string;
      max?: number;
    } = {},
  ) {
    const error = state.fields?.[name];
    const props = {
      id: "product-" + name,
      name,
      value: values[name],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => change(name, event.target.value),
      required: options.required,
      maxLength: options.max || 4000,
      "aria-invalid": !!error,
      "aria-describedby": error ? name + "-error" : undefined,
    };
    return (
      <label htmlFor={props.id}>
        {label}
        {options.required && " *"}
        {options.long ? (
          <textarea {...props} rows={4} />
        ) : (
          <input
            {...props}
            type={options.type || "text"}
            min={options.type === "number" ? 0 : undefined}
            step={options.type === "number" ? "0.01" : undefined}
          />
        )}{" "}
        {error && (
          <span id={name + "-error"} className="admin-field-error">
            {error}
          </span>
        )}
      </label>
    );
  }
  return (
    <form action={action} className="admin-form" aria-busy={pending}>
      <input type="hidden" name="id" value={product?.id || ""} />
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending} className="admin-form-lock">
        <div className="admin-form-layout">
          <div>
            <section className="admin-panel">
              <h2>Basic information</h2>
              <div className="admin-fields-grid">
                {field("name", "Product name", { required: true, max: 160 })}
                {field("slug", "Slug", { required: true, max: 160 })}
                <label htmlFor="product-category">
                  Category *
                  <select
                    id="product-category"
                    name="category_id"
                    value={values.category_id}
                    onChange={(e) => change("category_id", e.target.value)}
                    required
                    aria-invalid={!!state.fields?.category_id}
                    aria-describedby={
                      state.fields?.category_id ? "category-error" : undefined
                    }
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {state.fields?.category_id && (
                    <span id="category-error" className="admin-field-error">
                      {state.fields.category_id}
                    </span>
                  )}
                </label>
                {field("price", "Price (PHP)", {
                  required: true,
                  type: "number",
                })}
              </div>
              {!categories.length && (
                <p className="admin-help">
                  Add a category in{" "}
                  <Link href="/admin/categories">Categories</Link> before saving
                  a product.
                </p>
              )}
              {field("short_description", "Short description", { max: 500 })}
              {field("description", "Description", { long: true, max: 10000 })}
            </section>
            <section className="admin-panel">
              <h2>Product details</h2>
              <div className="admin-fields-grid">
                {field("size", "Size", { max: 80 })}
                {field("condition", "Condition", { max: 160 })}
                {field("material", "Material", { max: 160 })}
                {field("color", "Color", { max: 160 })}
              </div>
              {field("measurements", "Measurements", { long: true })}
              {field("care_instructions", "Care instructions", { long: true })}
            </section>
          </div>
          <div>
            <section className="admin-panel">
              <h2>Status &amp; visibility</h2>
              <label htmlFor="product-status">
                Status *
                <select
                  id="product-status"
                  name="status"
                  value={values.status}
                  onChange={(e) => change("status", e.target.value)}
                  required
                >
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="admin-checkbox">
                <input
                  name="featured"
                  type="checkbox"
                  checked={values.featured}
                  onChange={(e) =>
                    setValues({ ...values, featured: e.target.checked })
                  }
                />
                Featured
              </label>
              <label className="admin-checkbox">
                <input
                  name="bestseller"
                  type="checkbox"
                  checked={values.bestseller}
                  onChange={(e) =>
                    setValues({ ...values, bestseller: e.target.checked })
                  }
                />
                Bestseller
              </label>
              <p className="admin-help">
                Sold and archived pieces remain part of the collection history.
              </p>
            </section>
            <section className="admin-panel">
              <h2>Product images</h2>
              <p className="admin-help">Image upload will be added later.</p>
              <div className="admin-image-grid">
                {["Primary", "Additional", "Additional", "Additional"].map(
                  (label, index) => (
                    <ImagePlaceholder key={index} large label={label} />
                  ),
                )}
              </div>
            </section>
          </div>
        </div>
        <div className="admin-form-actions">
          <Link
            className="admin-button admin-button-secondary"
            href="/admin/products"
          >
            Cancel
          </Link>
          <button
            className="admin-button"
            disabled={pending || !categories.length}
          >
            {pending ? "SAVING..." : product ? "SAVE CHANGES" : "SAVE PRODUCT"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
