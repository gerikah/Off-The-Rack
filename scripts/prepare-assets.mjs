import sharp from "sharp";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

// Source photographs remain untouched. WebP derivatives reduce transfer sizes.
const root = process.cwd();
const destination = path.join(root, "public", "images");
await mkdir(destination, { recursive: true });
const normalize = (name) =>
  name
    .replace(/\.png$/i, "")
    .replaceAll(" ", "-")
    .toLowerCase();
for (const folder of ["jackets", "logo"]) {
  for (const name of await readdir(path.join(root, "assets", folder))) {
    if (!name.endsWith(".png")) continue;
    let input = sharp(path.join(root, "assets", folder, name));
    if (folder === "logo") input = input.trim({ threshold: 10 });
    await input
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(path.join(destination, `${normalize(name)}.webp`));
  }
}
await sharp(path.join(root, "assets", "background.png"))
  .webp({ quality: 82 })
  .toFile(path.join(destination, "background.webp"));
await sharp(
  path.join(root, "assets", "logo", "star off the rack logo-favicon.png"),
)
  .trim({ threshold: 10 })
  .resize(96, 96, { fit: "contain", background: "transparent" })
  .png()
  .toFile(path.join(root, "public", "icon.png"));
console.log("Prepared optimized brand assets in public/images.");
