import type { Product, ProductImage } from "./types";
import { isManagedImagePath } from "./images/validation";
export const PRODUCT_IMAGE_FALLBACK = "/images/background.webp";
export const PRODUCT_IMAGE_BUCKET = "product-images";

const INVALID_PRODUCT_IMAGE = "/__invalid-product-image__";

export function productImageUrl(
  url: string | null | undefined,
  storagePath?: string | null,
) {
  if (isManagedImagePath(storagePath)) {
    try {
      const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
      return new URL(
        `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${storagePath}`,
        project,
      ).href;
    } catch {
      // Keep evaluating the stored URL so a configuration error stays visible.
    }
  }
  if (url?.startsWith("/") && !url.includes("..")) return url;
  try {
    const image = new URL(url || "");
    if (image.protocol === "https:" || image.protocol === "http:")
      return image.href;
  } catch {
    /* An image row with a malformed URL must not become unrelated artwork. */
  }
  return url ? INVALID_PRODUCT_IMAGE : PRODUCT_IMAGE_FALLBACK;
}
export function getGalleryImages(images: ProductImage[]) {
  return [...images].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
}
export function selectPrimaryImage(images: ProductImage[]) {
  const ordered = getGalleryImages(images);
  return ordered.find((candidate) => candidate.is_primary) || ordered[0];
}
export function getPrimaryImage(product: Product) {
  const image = selectPrimaryImage(product.images);
  return {
    src: image
      ? productImageUrl(image.image_url, image.storage_path)
      : PRODUCT_IMAGE_FALLBACK,
    alt: image?.alt_text?.trim() || product.name,
  };
}
export const formatPrice = (price: number) =>
  "PHP " +
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(price);
