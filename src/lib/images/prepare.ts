import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MAX_UPLOAD_IMAGE_BYTES,
  validateImageFile,
} from "./validation";

export async function prepareBrowserImage(file: File): Promise<File> {
  validateImageFile(
    file.size,
    file.type,
    new Uint8Array(await file.slice(0, 128).arrayBuffer()),
  );
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This image could not be opened. Export it as JPEG, PNG or WebP and try again.",
    );
  }
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > MAX_IMAGE_PIXELS
    )
      throw new Error("Choose an image smaller than 40 megapixels.");
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Image preparation is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.72, 0.58]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (blob?.type === "image/webp" && blob.size <= MAX_UPLOAD_IMAGE_BYTES)
        return new File([blob], "product.webp", { type: "image/webp" });
    }
    throw new Error(
      "This image is too detailed to upload. Export a smaller image and try again.",
    );
  } finally {
    bitmap.close();
  }
}
