import sharp from "sharp";
import { readFile } from "node:fs/promises";
const logo = await readFile("public/images/off-the-rack-logo.webp");
const photo = await sharp("public/images/feature-jacket-2.webp")
  .resize(480, 630, { fit: "cover" })
  .jpeg({ quality: 88 })
  .toBuffer();
const graphic = Buffer.from(
  `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#0a0a0a"/><path d="M48 40H1152M48 590H1152" stroke="#555"/><text x="52" y="103" font-family="Arial,sans-serif" font-size="20" letter-spacing="4" fill="#aaa">HAND PAINTED IN THE PHILIPPINES</text><text x="48" y="231" font-family="Impact,Arial Black,sans-serif" font-size="90" font-weight="900" fill="#f2f0ea">WEARABLE</text><text x="48" y="322" font-family="Impact,Arial Black,sans-serif" font-size="90" font-weight="900" fill="#f2f0ea">ART.</text><text x="52" y="390" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#aaa">NO REPEATS.</text><text x="52" y="557" font-family="Arial,sans-serif" font-size="17" letter-spacing="3" fill="#ccc">ONE OF ONE. OFF THE RACK.</text></svg>`,
);
const brand = await sharp(logo)
  .resize({ width: 235, height: 95, fit: "inside" })
  .toBuffer();
await sharp(graphic)
  .composite([
    { input: photo, left: 720, top: 0 },
    { input: brand, left: 50, top: 430 },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile("public/social-sharing.jpg");
for (const [size, path] of [
  [180, "apple-touch-icon.png"],
  [192, "app-icon-192.png"],
  [512, "app-icon-512.png"],
]) {
  await sharp("public/icon.png")
    .resize(size, size, { fit: "contain", background: "#0a0a0a" })
    .png()
    .toFile("public/" + path);
}
console.log("Created sharing image 1200x630 and branded app icons.");
