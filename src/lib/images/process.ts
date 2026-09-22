import sharp from "sharp";
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MAX_UPLOAD_IMAGE_BYTES,
  validateImageFile,
} from "./validation";

// Node-only decoder imported exclusively by the server admin image module.
// Decode and re-encode even correctly signed images, stripping EXIF/GPS metadata
// and trailing payloads. Browser checks are convenience, never authorization.
export async function processProductImage(file: File) {
  if (file.size > MAX_UPLOAD_IMAGE_BYTES)
    throw new Error(
      "The prepared image must be 3 MB or smaller. Choose a smaller image.",
    );
  const input = new Uint8Array(await file.arrayBuffer());
  validateImageFile(file.size, file.type, input);
  try {
    const decoder = sharp(input, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "warning",
    });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
      throw new Error("unsupported dimensions or animation");
    const output = await decoder
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    if (output.length > MAX_UPLOAD_IMAGE_BYTES)
      throw new Error("output too large");
    return output;
  } catch {
    throw new Error(
      "This image could not be safely processed. Use a still image below 40 megapixels.",
    );
  }
}
