import { expect, test } from "@playwright/test";
import {
  getGalleryImages,
  productImageUrl,
  PRODUCT_IMAGE_FALLBACK,
} from "../src/lib/product-utils";
import type { ProductImage } from "../src/lib/types";
const image = (
  id: string,
  sort_order: number,
  is_primary = false,
): ProductImage => ({
  id,
  sort_order,
  is_primary,
  product_id: "test",
  image_url: "/images/7.webp",
  storage_path: null,
  alt_text: null,
  created_at: "2026-09-01",
});
test("image ordering is stable with no primary, late primary, or multiple primary flags", () => {
  const input = [image("last", 20), image("first", 0), image("middle", 10)];
  expect(getGalleryImages(input).map((i) => i.id)).toEqual([
    "first",
    "middle",
    "last",
  ]);
  expect(
    getGalleryImages([
      image("last", 20, true),
      image("first", 0),
      image("middle", 10),
    ]).map((i) => i.id),
  ).toEqual(["last", "first", "middle"]);
  expect(
    getGalleryImages([image("last", 20, true), image("first", 0, true)]).map(
      (i) => i.id,
    ),
  ).toEqual(["first", "last"]);
  expect(input.map((i) => i.id)).toEqual(["last", "first", "middle"]);
  expect(getGalleryImages([])).toEqual([]);
});
test("missing and untrusted image URLs use the existing fallback", () => {
  expect(productImageUrl(null)).toBe(PRODUCT_IMAGE_FALLBACK);
  expect(productImageUrl("javascript:alert(1)")).toBe(PRODUCT_IMAGE_FALLBACK);
  expect(productImageUrl("https://unapproved.example/product.jpg")).toBe(
    PRODUCT_IMAGE_FALLBACK,
  );
  expect(productImageUrl("/images/../secret")).toBe(PRODUCT_IMAGE_FALLBACK);
  expect(productImageUrl("/images/7.webp")).toBe("/images/7.webp");
});
