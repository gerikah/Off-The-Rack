"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveCategoryAction, deleteCategoryAction } from "@/app/admin/actions";
import type { AdminCategory } from "@/lib/admin/data";
import { slugify } from "@/lib/admin/validation";
import { AdminEmpty } from "./ui";
import { ConfirmAction } from "./confirm-action";
import { useAdminNotice } from "./notice";
function CategoryDialog({
  category,
  onClose,
}: {
  category: AdminCategory | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveCategoryAction, {});
  const [name, setName] = useState(category?.name || "");
  const [slug, setSlug] = useState(category?.slug || "");
  const [description, setDescription] = useState(category?.description || "");
  const [manual, setManual] = useState(!!category);
  const dialog = useRef<HTMLDialogElement>(null);
  const notify = useAdminNotice();
  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);
  useEffect(() => {
    if (state.success) {
      notify(state.message || "CATEGORY SAVED.");
      onClose();
    }
  }, [state, notify, onClose]);
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby="category-title"
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else onClose();
      }}
    >
      <h2 id="category-title">{category ? "Edit category" : "Add category"}</h2>
      <form action={action} className="admin-form" aria-busy={pending}>
        <input type="hidden" name="id" value={category?.id || ""} />
        <fieldset disabled={pending} className="admin-form-lock">
          <label>
            Category name *
            <input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!manual) setSlug(slugify(e.target.value));
              }}
              required
              minLength={2}
              maxLength={120}
              aria-invalid={!!state.fields?.name}
            />
          </label>
          <label>
            Slug *
            <input
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setManual(true);
              }}
              required
              maxLength={160}
              aria-invalid={!!state.fields?.slug}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </label>
          {state.error && (
            <p className="admin-error" role="alert">
              {state.error} {Object.values(state.fields || {}).join(" ")}
            </p>
          )}
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-button admin-button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="admin-button" disabled={pending}>
              {pending ? "SAVING..." : "SAVE CATEGORY"}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
export function CategoriesManager({
  categories,
}: {
  categories: AdminCategory[];
}) {
  const [editing, setEditing] = useState<AdminCategory | null | undefined>(
    undefined,
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Categories</h1>
          <p>Keep the collection organized.</p>
        </div>
        <button
          className="admin-button"
          type="button"
          onClick={() => setEditing(null)}
        >
          + ADD CATEGORY
        </button>
      </div>
      {!categories.length ? (
        <AdminEmpty
          title="NO CATEGORIES YET."
          description="Add your first category to organize the rack."
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Products</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td data-label="Name">
                    <strong>{category.name}</strong>
                    {category.description && (
                      <small>{category.description}</small>
                    )}
                  </td>
                  <td data-label="Slug">{category.slug}</td>
                  <td data-label="Products">{category.productCount}</td>
                  <td data-label="Actions">
                    <div className="admin-row-actions">
                      <button
                        className="admin-text-button"
                        type="button"
                        onClick={() => setEditing(category)}
                      >
                        Edit
                      </button>
                      <ConfirmAction
                        label="Delete"
                        title="DELETE CATEGORY?"
                        description={
                          category.productCount
                            ? category.productCount +
                              " products using this category will become uncategorized. Move products first if possible."
                            : "This permanently removes " +
                              category.name +
                              ". Products using this category will become uncategorized."
                        }
                        action={deleteCategoryAction}
                        fields={{ id: category.id }}
                        danger
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <CategoryDialog
          category={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
