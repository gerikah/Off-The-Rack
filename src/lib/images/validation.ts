export const MAX_SOURCE_IMAGE_BYTES = 5 * 1024 * 1024;
// Leave room for multipart overhead below the Next/Vercel request-body limit.
export const MAX_UPLOAD_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_DIMENSION = 2400;
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte))
    return "image/png";
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") {
    const boxLength = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getUint32(0);
    // AVIF must declare its major or compatible brand in the first ISO-BMFF box.
    for (
      let offset = 8;
      offset + 4 <= Math.min(boxLength, bytes.length, 128);
      offset += 4
    ) {
      if (offset !== 12 && ["avif", "avis"].includes(ascii(offset, offset + 4)))
        return "image/avif";
    }
  }
  return null;
}

export function validateImageFile(
  size: number,
  mime: string,
  bytes: Uint8Array,
) {
  if (!size || size > MAX_SOURCE_IMAGE_BYTES)
    throw new Error("Choose an image of 5 MB or smaller.");
  if (!IMAGE_MIME_TYPES.includes(mime as ImageMime))
    throw new Error("Choose a JPEG, PNG, WebP or AVIF image.");
  if (detectImageMime(bytes) !== mime)
    throw new Error(
      "The file contents do not match its image type. Export a new image and try again.",
    );
}

// Only objects created by this uploader may be removed automatically. Existing
// local assets, external URLs and unrecognized legacy paths are preserved.
export function isManagedImagePath(
  path: string | null | undefined,
): path is string {
  return (
    !!path &&
    /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(
      path,
    )
  );
}
