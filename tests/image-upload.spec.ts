import { expect, test } from "@playwright/test";
import sharp from "sharp";
import {
  detectImageMime,
  isManagedImagePath,
  MAX_SOURCE_IMAGE_BYTES,
  MAX_UPLOAD_IMAGE_BYTES,
  validateImageFile,
} from "../src/lib/images/validation";
import { processProductImage } from "../src/lib/images/process";

test("file validation rejects disguised and oversized images", () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  );
  expect(() => validateImageFile(svg.length, "image/png", svg)).toThrow(
    "contents do not match",
  );
  expect(() => validateImageFile(0, "image/png", new Uint8Array())).toThrow(
    "5 MB",
  );
  expect(() =>
    validateImageFile(
      MAX_SOURCE_IMAGE_BYTES + 1,
      "image/jpeg",
      new Uint8Array(),
    ),
  ).toThrow("5 MB");
  expect(() => validateImageFile(svg.length, "image/svg+xml", svg)).toThrow(
    "JPEG",
  );
  expect(detectImageMime(Buffer.from("RIFFxxxxWAVEdata"))).toBeNull();
  expect(detectImageMime(Buffer.from("xxxxftypheic0000"))).toBeNull();
});

test("server fully decodes images, resizes them and removes EXIF metadata", async () => {
  const input = await sharp({
    create: { width: 3000, height: 900, channels: 3, background: "#987654" },
  })
    .withMetadata({ orientation: 1 })
    .jpeg()
    .toBuffer();
  expect(detectImageMime(input)).toBe("image/jpeg");
  const result = await processProductImage(
    new File([input], "untrusted-name.php.jpg", { type: "image/jpeg" }),
  );
  const metadata = await sharp(result).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.width).toBe(2400);
  expect(metadata.height).toBe(720);
  expect(metadata.exif).toBeUndefined();
  const corrupt = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from("not a real image"),
  ]);
  await expect(
    processProductImage(
      new File([corrupt], "looks-valid.png", { type: "image/png" }),
    ),
  ).rejects.toThrow("safely processed");
});

test("server supports PNG, WebP and AVIF without enlarging small images", async () => {
  for (const format of ["png", "webp", "avif"] as const) {
    const input = await sharp({
      create: {
        width: 64,
        height: 32,
        channels: 4,
        background: { r: 100, g: 110, b: 120, alpha: 0.8 },
      },
    })
      .toFormat(format)
      .toBuffer();
    expect(detectImageMime(input)).toBe("image/" + format);
    const output = await processProductImage(
      new File([input], "photo." + format, { type: "image/" + format }),
    );
    expect((await sharp(output).metadata()).width).toBe(64);
  }
});

test("automated cleanup only recognizes unique uploader paths", () => {
  const path =
    "products/20000000-0000-4000-8000-000000000000/50000000-0000-4000-8000-000000000000.webp";
  expect(isManagedImagePath(path)).toBe(true);
  for (const value of [
    null,
    "",
    "/images/7.webp",
    "legacy/photo.jpg",
    "../" + path,
    path + "?version=1",
    "https://example.invalid/" + path,
    path.replace(".webp", ".svg"),
  ])
    expect(isManagedImagePath(value)).toBe(false);
});

test("server enforces upload and decoded pixel limits independently of browser checks", async () => {
  await expect(
    processProductImage(
      new File([new Uint8Array(MAX_UPLOAD_IMAGE_BYTES + 1)], "large.webp", {
        type: "image/webp",
      }),
    ),
  ).rejects.toThrow("3 MB");
  const oversizedDimensions = await sharp({
    create: { width: 7000, height: 6000, channels: 3, background: "#aabbcc" },
  })
    .png()
    .toBuffer();
  expect(oversizedDimensions.length).toBeLessThan(MAX_UPLOAD_IMAGE_BYTES);
  await expect(
    processProductImage(
      new File([oversizedDimensions], "large-dimensions.png", {
        type: "image/png",
      }),
    ),
  ).rejects.toThrow("40 megapixels");
});
