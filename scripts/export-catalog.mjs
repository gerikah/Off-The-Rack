import { mkdir, writeFile } from "node:fs/promises";
import { localProducts } from "../src/lib/catalog.ts";
const quote = (value) =>
  value === null
    ? "null"
    : typeof value === "boolean" || typeof value === "number"
      ? String(value)
      : "'" +
        (typeof value === "object" ? JSON.stringify(value) : value).replaceAll(
          "'",
          "''",
        ) +
        "'";
let sql =
  "-- SAMPLE CATALOG ONLY. Review all business details before any import.\nbegin;\n";
for (const product of localProducts) {
  const { images, ...row } = product;
  sql +=
    "insert into public.products (" +
    Object.keys(row)
      .map((key) => '"' + key + '"')
      .join(", ") +
    ") values (" +
    Object.values(row).map(quote).join(", ") +
    ");\n";
  images.forEach((url, index) => {
    sql +=
      "insert into public.product_images (product_id, url, sort_order) values (" +
      [product.id, url, index].map(quote).join(", ") +
      ");\n";
  });
}
sql += "commit;\n";
await mkdir(".work", { recursive: true });
await writeFile(".work/seed.sample.sql", sql);
console.log(
  "Sample import SQL written to .work/seed.sample.sql. Not applied to any database.",
);
