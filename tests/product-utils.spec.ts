import { expect, test } from "@playwright/test";
import {
  getGalleryImages,
  getPrimaryImage,
  productImageUrl,
  selectPrimaryImage,
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
test("gallery ordering follows sort order while cards prefer the primary image", () => {
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
  ).toEqual(["first", "middle", "last"]);
  expect(
    getGalleryImages([image("last", 20, true), image("first", 0, true)]).map(
      (i) => i.id,
    ),
  ).toEqual(["first", "last"]);
  expect(
    getPrimaryImage({
      id: "product",
      name: "Product",
      slug: "product",
      short_description: null,
      description: null,
      price: 1,
      category_id: null,
      category: null,
      size: null,
      condition: null,
      material: null,
      color: null,
      measurements: null,
      care_instructions: null,
      status: "available",
      featured: false,
      bestseller: false,
      created_at: "2026-09-01",
      updated_at: "2026-09-01",
      images: [image("last", 20, true), image("first", 0)],
    }).src,
  ).toBe("/images/7.webp");
  expect(input.map((i) => i.id)).toEqual(["last", "first", "middle"]);
  expect(getGalleryImages([])).toEqual([]);
});
test("only a missing image uses fallback; rejected URLs are not substituted", () => {
  expect(productImageUrl(null)).toBe(PRODUCT_IMAGE_FALLBACK);
  expect(productImageUrl("javascript:alert(1)")).not.toBe(
    PRODUCT_IMAGE_FALLBACK,
  );
  expect(productImageUrl("https://unapproved.example/product.jpg")).toBe(
    "https://unapproved.example/product.jpg",
  );
  expect(productImageUrl("/images/../secret")).not.toBe(PRODUCT_IMAGE_FALLBACK);
  expect(productImageUrl("/images/7.webp")).toBe("/images/7.webp");
});

test("one uploaded image is selected exactly as the product cover", () => {
  const uploaded = {
    ...image("uploaded", 0, true),
    image_url: "uploaded-url",
  };
  expect(selectPrimaryImage([uploaded])?.image_url).toBe("uploaded-url");
});
