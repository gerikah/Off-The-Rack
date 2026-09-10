// Local-only PostgREST test double. Never imported by the application.
import { createServer } from "node:http";
const timestamp = "2026-09-01T00:00:00Z";
const categories = ["Jackets", "Pants", "Tops", "Accessories", "Custom"].map(
  (name, i) => ({
    id: "10000000-0000-4000-8000-00000000000" + i,
    name,
    slug: name.toLowerCase(),
    description: null,
    created_at: timestamp,
    updated_at: timestamp,
  }),
);
const products = [
  "TEMP Bestseller",
  "TEMP New Arrival",
  "TEMP Sold",
  "TEMP Archived",
].map((name, i) => ({
  id: "20000000-0000-4000-8000-00000000000" + i,
  name,
  slug: "temp-piece-" + i,
  short_description: "Temporary integration fixture",
  description: "A test piece with real-shaped database fields.",
  price: [2400, 1200, 3200, 1800][i],
  category_id: categories[i === 1 ? 1 : 0].id,
  category: categories[i === 1 ? 1 : 0],
  size: "M",
  condition: "Reworked",
  material: i === 1 ? null : "Denim",
  color: "Indigo",
  measurements: i === 1 ? null : "Chest: 54 cm",
  care_instructions: i === 1 ? null : "Hand wash cold.",
  status: ["available", "available", "sold", "archived"][i],
  featured: false,
  bestseller: i === 0 || i === 2,
  created_at: "2026-09-0" + (i + 1) + "T00:00:00Z",
  updated_at: timestamp,
  images:
    i === 1
      ? []
      : [0, 1, 2].map((n) => ({
          id: "image-" + i + "-" + n,
          product_id: "20000000-0000-4000-8000-00000000000" + i,
          image_url: [
            "/images/7.webp",
            "/images/background.webp",
            "/images/11.webp",
          ][n],
          storage_path: null,
          alt_text: "Fixture view " + n,
          sort_order: n,
          is_primary: n === 2,
          created_at: timestamp,
        })),
}));
let scenario = "populated",
  writes = [],
  queries = [];
const send = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(data === undefined ? undefined : JSON.stringify(data));
};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4318");
  let text = "";
  for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : {};
  if (url.pathname === "/__control") {
    if (req.method === "POST") {
      scenario = body.scenario || "populated";
      writes = [];
      queries = [];
    }
    return send(res, 200, { scenario, writes, queries });
  }
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  const table = url.pathname.split("/").pop();
  queries.push({ table, method: req.method, search: url.search });
  if (req.method === "POST") {
    if (!["inquiries", "newsletter_subscribers"].includes(table))
      return send(res, 403, { code: "42501", message: "write denied" });
    if (scenario === "error")
      return send(res, 403, {
        code: "42501",
        message: "PRIVATE SQL ERROR MUST NOT LEAK",
      });
    if (
      table === "newsletter_subscribers" &&
      writes.some((w) => w.table === table && w.body.email === body.email)
    )
      return send(res, 409, {
        code: "23505",
        message: "PRIVATE duplicate constraint",
      });
    writes.push({ table, body });
    return send(res, 201);
  }
  if (table === "categories") return send(res, 200, categories);
  if (table === "products") {
    if (scenario === "error")
      return send(res, 503, {
        code: "XX000",
        message: "PRIVATE SQL ERROR MUST NOT LEAK",
      });
    let rows = scenario === "empty" ? [] : [...products];
    for (const key of ["status", "bestseller", "slug", "category_id", "id"]) {
      const filter = url.searchParams.get(key);
      if (!filter) continue;
      if (filter.startsWith("eq."))
        rows = rows.filter((p) => String(p[key]) === filter.slice(3));
      if (filter.startsWith("neq."))
        rows = rows.filter((p) => String(p[key]) !== filter.slice(4));
      if (filter.startsWith("in.("))
        rows = rows.filter((p) =>
          filter.slice(4, -1).split(",").includes(String(p[key])),
        );
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    rows = rows.slice(Number(url.searchParams.get("offset") || 0));
    if (url.searchParams.has("limit"))
      rows = rows.slice(0, Number(url.searchParams.get("limit")));
    if (url.searchParams.get("select") === "id")
      rows = rows.map((p) => ({ id: p.id }));
    if (req.headers.accept?.includes("vnd.pgrst.object+json"))
      return send(
        res,
        rows.length ? 200 : 406,
        rows[0] || {
          code: "PGRST116",
          details: "The result contains 0 rows",
          message: "not found",
        },
      );
    return send(res, 200, rows);
  }
  return send(res, 404, { code: "missing" });
}).listen(4318, "127.0.0.1");
