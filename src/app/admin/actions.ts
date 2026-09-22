"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct,
  updateProduct,
  updateProductStatus,
  updateProductFeatured,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  updateInquiryStatus,
} from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/auth";
import { actionError, AdminError } from "@/lib/admin/errors";
import type { ActionState } from "@/lib/admin/validation";
function refreshInventory() {
  revalidatePath("/admin", "layout");
  for (const path of ["/", "/shop", "/archive", "/sitemap.xml"])
    revalidatePath(path);
  revalidatePath("/product/[slug]", "page");
}
export async function saveProductAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") || "");
  let savedId = id;
  try {
    const payload = {
      ...Object.fromEntries(form),
      featured: form.get("featured") === "on",
      bestseller: form.get("bestseller") === "on",
    };
    if (id) await updateProduct(id, payload);
    else savedId = await createProduct(payload);
  } catch (error) {
    return actionError(error);
  }
  refreshInventory();
  redirect(
    id
      ? "/admin/products?notice=updated"
      : "/admin/products/" + savedId + "/edit?notice=added",
  );
}
export async function productAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const action = String(form.get("operation"));
  let pendingCleanup = false;
  try {
    if (form.get("confirm") !== "yes")
      throw new AdminError("Confirm this action first.");
    const id = String(form.get("id"));
    if (action === "delete") pendingCleanup = await deleteProduct(id);
    else if (action === "feature" || action === "unfeature")
      await updateProductFeatured(id, action === "feature");
    else await updateProductStatus(id, action);
  } catch (error) {
    return actionError(error);
  }
  refreshInventory();
  return {
    success: true,
    message:
      action === "delete"
        ? pendingCleanup
          ? "PRODUCT DELETED. Unused image cleanup is pending; retry it from Products."
          : "PRODUCT DELETED."
        : action === "feature"
          ? "PRODUCT FEATURED."
          : action === "unfeature"
            ? "PRODUCT REMOVED FROM FEATURED."
            : action === "sold"
              ? "PRODUCT MARKED SOLD."
              : action === "archived"
                ? "PRODUCT ARCHIVED."
                : "PRODUCT RESTORED.",
  };
}
export async function saveCategoryAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") || "");
  try {
    if (id) await updateCategory(id, Object.fromEntries(form));
    else await createCategory(Object.fromEntries(form));
  } catch (error) {
    return actionError(error);
  }
  refreshInventory();
  return {
    success: true,
    message: id ? "CATEGORY UPDATED." : "CATEGORY ADDED.",
  };
}
export async function deleteCategoryAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    if (form.get("confirm") !== "yes")
      throw new AdminError("Confirm this action first.");
    await deleteCategory(String(form.get("id")));
  } catch (error) {
    return actionError(error);
  }
  refreshInventory();
  return { success: true, message: "CATEGORY DELETED." };
}
export async function inquiryStatusAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const status = form.get("next_status") || form.get("status");
  try {
    await updateInquiryStatus(String(form.get("id")), status);
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/admin", "layout");
  return {
    success: true,
    message: "INQUIRY MARKED " + String(status).toUpperCase() + ".",
  };
}
