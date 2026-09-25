import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import type { ProductImage } from "@/lib/types";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/product-utils";
import { processProductImage } from "@/lib/images/process";
import { isManagedImagePath } from "@/lib/images/validation";
import { logDataError } from "@/lib/data/errors";
import { requireAdmin } from "./auth";
import { AdminError, databaseError } from "./errors";
import { idSchema } from "./validation";

const imageDetails = z.object({
  product_id: idSchema,
  image_id: z.union([idSchema, z.literal("")]),
  alt_text: z
    .string()
    .trim()
    .min(1, "Describe the image for customers using screen readers.")
    .max(300),
  is_primary: z.boolean(),
});

type Client = SupabaseClient<Database>;
type ImageFailure = {
  code?: string;
  statusCode?: string | number;
  status?: string | number;
  message?: string;
};

function logImageFailure(
  operation: string,
  error: ImageFailure,
  productId: string,
  storagePath?: string,
) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[product-images] operation failed", {
      operation,
      bucket: PRODUCT_IMAGE_BUCKET,
      storagePath,
      productId,
      code: error.code || "storage_error",
      status: error.statusCode || error.status,
    });
  }
}

function uploadMessage(error: ImageFailure) {
  const status = Number(error.statusCode || error.status);
  const value = `${error.code || ""} ${error.message || ""}`.toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    /unauthor|permission|policy/.test(value)
  )
    return "You are not authorized to upload images.";
  if (status === 404 || /bucket.*not found|not found.*bucket/.test(value))
    return "Image storage is not configured. The product-images bucket is unavailable.";
  if (status === 413 || /too large|size limit|maximum allowed/.test(value))
    return "Image file is too large.";
  if (/mime|content.?type|unsupported/.test(value))
    return "Unsupported image type.";
  return "Could not upload image.";
}
export async function cleanupImageFiles(
  client: Client,
  paths: (string | null)[],
) {
  let pending = false;
  for (const path of new Set(paths.filter(isManagedImagePath))) {
    const claim = await client.rpc("otr_claim_image_cleanup", {
      object_path: path,
    });
    if (claim.error) {
      logDataError("claim image cleanup", claim.error);
      pending = true;
      continue;
    }
    if (!claim.data) continue; // Still shared/referenced: do not delete it.
    const removal = await client.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .remove([path]);
    if (removal.error) {
      logDataError("remove unused image", {});
      pending = true;
      continue;
    }
    const completion = await client.rpc("otr_complete_image_cleanup", {
      object_path: path,
    });
    if (completion.error) {
      logDataError("complete image cleanup", completion.error);
      pending = true;
    }
  }
  return pending;
}

export async function retryImageCleanup() {
  const { client } = await requireAdmin();
  const { data, error } = await client
    .from("product_image_cleanup")
    .select("storage_path")
    .is("completed_at", null)
    .order("created_at")
    .limit(20);
  if (error) databaseError("read image cleanup queue", error);
  return cleanupImageFiles(
    client,
    data.map((item) => item.storage_path),
  );
}

export async function cleanupProductImageFiles(
  client: Client,
  paths: (string | null)[],
) {
  const immediatePending = await cleanupImageFiles(client, paths);
  try {
    // Database triggers also queue paths missed by a stale UI or a cascade.
    return (await retryImageCleanup()) || immediatePending;
  } catch {
    logDataError("retry queued image cleanup", {});
    return true;
  }
}

async function currentImage(
  client: Client,
  productId: string,
  imageId: string,
) {
  const { data, error } = await client
    .from("product_images")
    .select(
      "id,product_id,image_url,storage_path,alt_text,sort_order,is_primary,created_at",
    )
    .eq("product_id", productId)
    .eq("id", imageId)
    .maybeSingle();
  if (error) databaseError("read product image", error);
  if (!data)
    throw new AdminError("This image no longer exists. Refresh and try again.");
  return data;
}

async function gallery(
  client: Client,
  productId: string,
): Promise<ProductImage[]> {
  const { data, error } = await client
    .from("product_images")
    .select(
      "id,product_id,image_url,storage_path,alt_text,sort_order,is_primary,created_at",
    )
    .eq("product_id", productId)
    .order("sort_order")
    .order("id");
  if (error) databaseError("read updated product images", error);
  return data;
}

export async function saveProductImage(form: FormData) {
  const { client } = await requireAdmin();
  const details = imageDetails.parse({
    product_id: form.get("product_id"),
    image_id: form.get("image_id") || "",
    alt_text: form.get("alt_text"),
    is_primary: form.get("is_primary") === "yes",
  });
  const product = await client
    .from("products")
    .select("id")
    .eq("id", details.product_id)
    .maybeSingle();
  if (product.error) databaseError("read image product", product.error);
  if (!product.data) throw new AdminError("This product no longer exists.");
  const previous = details.image_id
    ? await currentImage(client, details.product_id, details.image_id)
    : null;
  let upload: { storage_path: string; image_url: string } | undefined;
  const file = form.get("image");
  if (file instanceof File && file.size) {
    let bytes: Buffer;
    try {
      bytes = await processProductImage(file);
    } catch (error) {
      throw new AdminError(
        error instanceof Error
          ? error.message
          : "Choose a valid product image.",
      );
    }
    const path = `products/${details.product_id}/${crypto.randomUUID()}.webp`;
    const { error } = await client.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) {
      logImageFailure("upload", error, details.product_id, path);
      throw new AdminError(uploadMessage(error));
    }
    upload = {
      storage_path: path,
      image_url: client.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path)
        .data.publicUrl,
    };
  } else if (!previous) {
    throw new AdminError("Choose an image to upload.");
  }
  const saved = await client.rpc("otr_save_product_image", {
    product_uuid: details.product_id,
    image_uuid: details.image_id || null,
    image_data: {
      alt_text: details.alt_text,
      is_primary: details.is_primary,
      ...upload,
    },
  });
  if (saved.error) {
    const cleanupPending = upload
      ? await cleanupImageFiles(client, [upload.storage_path])
      : false;
    logImageFailure(
      "save image record",
      saved.error,
      details.product_id,
      upload?.storage_path,
    );
    if (saved.error.code === "23514")
      throw new AdminError(
        "Could not save this image. Each product supports up to 12 images; refresh and try again.",
      );
    if (saved.error.code === "42501")
      throw new AdminError("You are not authorized to save image records.");
    throw new AdminError(
      cleanupPending
        ? "Could not save image record. The unused file is queued for cleanup."
        : "Could not save image record. The uploaded file was rolled back.",
    );
  }
  const pendingCleanup =
    upload && previous
      ? await cleanupProductImageFiles(client, [previous.storage_path])
      : false;
  return { images: await gallery(client, details.product_id), pendingCleanup };
}

export async function removeProductImage(form: FormData) {
  const { client } = await requireAdmin();
  const productId = idSchema.parse(form.get("product_id"));
  const imageId = idSchema.parse(form.get("image_id"));
  if (form.get("confirm") !== "yes")
    throw new AdminError("Confirm image removal first.");
  const previous = await currentImage(client, productId, imageId);
  const { error } = await client.rpc("otr_remove_product_image", {
    product_uuid: productId,
    image_uuid: imageId,
  });
  if (error) databaseError("remove product image", error);
  const pendingCleanup = await cleanupProductImageFiles(client, [
    previous.storage_path,
  ]);
  return { images: await gallery(client, productId), pendingCleanup };
}
