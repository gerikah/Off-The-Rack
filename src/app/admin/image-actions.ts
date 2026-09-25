"use server";
import { revalidatePath } from "next/cache";
import type { ProductImage } from "@/lib/types";
import { actionError } from "@/lib/admin/errors";
import type { ActionState } from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  removeProductImage,
  retryImageCleanup,
  saveProductImage,
} from "@/lib/admin/images";
export type ImageActionState = ActionState & { images?: ProductImage[] };
export async function productImageAction(
  form: FormData,
): Promise<ImageActionState> {
  await requireAdmin();
  try {
    const result =
      form.get("operation") === "remove"
        ? await removeProductImage(form)
        : await saveProductImage(form);
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/[id]/edit", "page");
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/archive");
    revalidatePath("/product/[slug]", "page");
    return {
      success: true,
      images: result.images,
      message: result.pendingCleanup
        ? `${form.get("operation") === "remove" ? "Image removed." : "Image saved."} Unused-file cleanup is pending; retry it from Products.`
        : form.get("operation") === "remove"
          ? "Image removed."
          : "Image saved.",
    };
  } catch (error) {
    return actionError(error);
  }
}
export async function imageCleanupAction(
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _state;
  void _form;
  await requireAdmin();
  try {
    const pending = await retryImageCleanup();
    return {
      success: !pending,
      message: pending
        ? "Some cleanup is still pending. Check Storage policies and try again."
        : "Cleanup checked. Up to 20 pending files processed; shared images were preserved.",
    };
  } catch (error) {
    return actionError(error);
  }
}
