import type { Product, ProductImage } from "./types";
export const PRODUCT_IMAGE_FALLBACK = "/images/background.webp";
export const PRODUCT_IMAGE_BUCKET = "product-images";
export function productImageUrl(url: string | null | undefined) {
  if (url?.startsWith("/images/") && !url.includes("..")) return url;
  try {
    const image = new URL(url || "");
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (
      image.protocol === "https:" &&
      image.origin === project.origin &&
      image.pathname.startsWith(
        "/storage/v1/object/public/" + PRODUCT_IMAGE_BUCKET + "/",
      )
    )
      return image.href;
  } catch {
    /* Use the existing local fallback for missing or invalid URLs. */
  }
  return PRODUCT_IMAGE_FALLBACK;
}
export function getGalleryImages(images: ProductImage[]) {
  const ordered = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const primary = ordered.findIndex((image) => image.is_primary);
  if (primary > 0) ordered.unshift(...ordered.splice(primary, 1));
  return ordered;
}
export function getPrimaryImage(product: Product) {
  const image = getGalleryImages(product.images)[0];
  return {
    src: productImageUrl(image?.image_url),
    alt: image?.alt_text?.trim() || product.name,
  };
}
export const formatPrice = (price: number) =>
  "PHP " +
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(price);
