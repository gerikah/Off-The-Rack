// Local-only PostgREST test double. Never imported by the application.
import { createServer } from "node:http";
import { newsletterFixture } from "./newsletter.mjs";
import { loopsFixture } from "./loops.mjs";
const loops = loopsFixture();
const newsletter = newsletterFixture();
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
          id: `60000000-0000-4000-8000-${String(i * 10 + n).padStart(12, "0")}`,
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

// Stateful Auth/PostgREST double for storefront and admin integration tests.
const seedInquiries = ["new", "read", "replied", "resolved"].map(
  (status, index) => ({
    id: "30000000-0000-4000-8000-00000000000" + index,
    customer_name: "Test Customer " + index,
    email: "customer" + index + "@example.invalid",
    mobile: index === 0 ? "09000000000" : null,
    inquiry_type: index === 1 ? "custom" : index === 2 ? "general" : "product",
    product_id: index === 0 || index === 3 ? products[0].id : null,
    garment_type: index === 1 ? "Denim jacket" : null,
    preferred_size: index === 1 ? "L" : null,
    design_idea: index === 1 ? "Silver artwork on black denim." : null,
    reference_url: index === 1 ? "https://example.invalid/reference" : null,
    message: "Temporary inquiry for admin integration tests.",
    status,
    created_at: "2026-09-0" + (index + 1) + "T00:00:00Z",
    updated_at: timestamp,
  }),
);
let scenario = "populated",
  writes = [],
  queries = [],
  membership = true;
let productRows = structuredClone(products),
  categoryRows = structuredClone(categories),
  inquiryRows = structuredClone(seedInquiries);
const sessions = new Map();
const storageObjects = new Map(),
  imageCleanup = new Map();
const send = (res, status, data, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(data === undefined ? undefined : JSON.stringify(data));
};
function userFor(email) {
  return {
    id:
      email === "admin@example.invalid"
        ? "40000000-0000-4000-8000-000000000000"
        : "40000000-0000-4000-8000-000000000001",
    email,
    email_confirmed_at: timestamp,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: timestamp,
  };
}
function issueSession(email) {
  const user = userFor(email),
    now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      sub: user.id,
      email,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + 3600,
      session_id: crypto.randomUUID(),
    }) +
    "." +
    Buffer.from("test-signature").toString("base64url");
  sessions.set(token, user);
  return {
    access_token: token,
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    user,
  };
}
function filterRows(rows, url) {
  for (const key of [
    "status",
    "bestseller",
    "slug",
    "category_id",
    "id",
    "product_id",
  ]) {
    const filter = url.searchParams.get(key);
    if (!filter) continue;
    if (filter.startsWith("eq."))
      rows = rows.filter((row) => String(row[key]) === filter.slice(3));
    if (filter.startsWith("neq."))
      rows = rows.filter((row) => String(row[key]) !== filter.slice(4));
    if (filter.startsWith("in.("))
      rows = rows.filter((row) =>
        filter.slice(4, -1).split(",").includes(String(row[key])),
      );
  }
  return rows;
}
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:4318");
    let text = "";
    for await (const chunk of req) text += chunk;
    const body =
      text && req.headers["content-type"]?.includes("application/json")
        ? JSON.parse(text)
        : {};
    if (url.pathname === "/__control") {
      if (req.method === "POST") {
        if (body.loops) {
          loops.configure(body.loops);
        } else if (body.shareImage) {
          const source = productRows
            .flatMap((row) => row.images || [])
            .find((image) => image.id === body.shareImage);
          const target = productRows.find(
            (row) => row.id === body.targetProduct,
          );
          if (source && target)
            target.images.push({
              ...source,
              id: crypto.randomUUID(),
              product_id: target.id,
            });
        } else if (body.revokeMembership) {
          membership = false;
        } else {
          scenario = body.scenario || "populated";
          writes = [];
          queries = [];
          membership = true;
          sessions.clear();
          newsletter.reset();
          loops.reset();
          storageObjects.clear();
          imageCleanup.clear();
          productRows = scenario === "empty" ? [] : structuredClone(products);
          categoryRows = structuredClone(categories);
          inquiryRows =
            scenario === "empty" ? [] : structuredClone(seedInquiries);
        }
      }
      return send(res, 200, {
        scenario,
        writes,
        queries,
        products: productRows,
        categories: categoryRows,
        inquiries: inquiryRows,
        newsletter: newsletter.state(),
        loops: loops.state(),
        storage: [...storageObjects.keys()],
        cleanup: [...imageCleanup.values()],
      });
    }
    if (await loops.handle(req, res, url.pathname, body)) return;
    if (url.pathname === "/health") return send(res, 200, { ok: true });
    const token = req.headers.authorization?.replace(/^Bearer /i, ""),
      user = sessions.get(token),
      admin = user?.email === "admin@example.invalid" && membership;
    if (url.pathname === "/auth/v1/token") {
      if (
        body.password !== "test-password" ||
        !["admin@example.invalid", "member@example.invalid"].includes(
          body.email,
        )
      )
        return send(res, 400, {
          error_code: "invalid_credentials",
          msg: "Invalid login credentials",
        });
      return send(res, 200, issueSession(body.email));
    }
    if (url.pathname === "/auth/v1/user")
      return user
        ? send(res, 200, user)
        : send(res, 401, { code: "bad_jwt", msg: "Invalid token" });
    if (url.pathname === "/auth/v1/logout") {
      sessions.delete(token);
      return send(res, 204);
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      if (!admin) return send(res, 403, { message: "denied" });
      const objectPath = url.pathname.replace(
        "/storage/v1/object/product-images/",
        "",
      );
      if (req.method === "POST") {
        storageObjects.set(objectPath, true);
        writes.push({
          table: "storage",
          method: "POST",
          body: { path: objectPath },
        });
        return send(res, 200, { Key: "product-images/" + objectPath });
      }
      if (req.method === "DELETE") {
        const removed = [];
        for (const path of body.prefixes || []) {
          const referenced = productRows.some((product) =>
            product.images?.some((image) => image.storage_path === path),
          );
          if (!referenced && imageCleanup.has(path)) {
            storageObjects.delete(path);
            removed.push({ name: path });
          }
        }
        writes.push({ table: "storage", method: "DELETE", body: { removed } });
        return send(res, 200, removed);
      }
    }
    const table = url.pathname.split("/").pop();
    queries.push({
      table,
      method: req.method,
      search: url.search,
      admin: !!admin,
    });
    if (table === "otr_subscribe_newsletter") {
      if (scenario === "error")
        return send(res, 403, {
          code: "42501",
          message: "PRIVATE SQL ERROR MUST NOT LEAK",
        });
      const result = loops.signup(body);
      if (result.status !== "already_subscribed")
        writes.push({
          table: "newsletter_subscribers",
          method: "POST",
          body: { email: body.email_value, is_active: true },
        });
      return send(res, 200, result);
    }
    const newsletterResult = newsletter.handle(table, body, admin);
    if (newsletterResult)
      return send(res, newsletterResult.status, newsletterResult.data);
    if (table === "otr_is_admin")
      return user
        ? send(res, 200, !!admin)
        : send(res, 401, { code: "42501", message: "denied" });
    if (
      [
        "otr_save_product_image",
        "otr_remove_product_image",
        "otr_claim_image_cleanup",
        "otr_complete_image_cleanup",
        "product_image_cleanup",
      ].includes(table)
    ) {
      if (!admin) return send(res, 403, { code: "42501", message: "denied" });
      if (table === "product_image_cleanup")
        return send(
          res,
          200,
          [...imageCleanup.values()].filter((item) => !item.completed_at),
        );
      if (table === "otr_claim_image_cleanup") {
        const referenced = productRows.some((product) =>
          product.images?.some(
            (image) => image.storage_path === body.object_path,
          ),
        );
        if (!referenced)
          imageCleanup.set(body.object_path, {
            storage_path: body.object_path,
            created_at: timestamp,
            completed_at: null,
          });
        return send(res, 200, !referenced);
      }
      if (table === "otr_complete_image_cleanup") {
        const record = imageCleanup.get(body.object_path);
        if (record) record.completed_at = new Date().toISOString();
        return send(res, 204);
      }
      const product = productRows.find((row) => row.id === body.product_uuid);
      if (!product) return send(res, 404, { code: "P0002" });
      product.images ||= [];
      if (table === "otr_remove_product_image") {
        product.images = product.images.filter(
          (image) => image.id !== body.image_uuid,
        );
        if (
          !product.images.some((image) => image.is_primary) &&
          product.images[0]
        )
          product.images[0].is_primary = true;
      } else {
        const existing = product.images.find(
          (image) => image.id === body.image_uuid,
        );
        if (body.image_data.is_primary)
          for (const image of product.images) image.is_primary = false;
        if (existing)
          Object.assign(existing, body.image_data, {
            is_primary: body.image_data.is_primary || existing.is_primary,
          });
        else
          product.images.push({
            id: crypto.randomUUID(),
            product_id: product.id,
            created_at: timestamp,
            sort_order: product.images.length,
            ...body.image_data,
            is_primary: !product.images.length,
          });
      }
      writes.push({
        table: "product_images",
        method: table === "otr_remove_product_image" ? "DELETE" : "POST",
        body,
      });
      return send(res, 204);
    }
    if (table === "product_images" && req.method === "GET") {
      let rows = filterRows(
        productRows.flatMap((row) => row.images || []),
        url,
      );
      if (req.headers.accept?.includes("vnd.pgrst.object+json"))
        return send(res, 200, rows[0] || null);
      return send(res, 200, rows);
    }
    if (table === "otr_delete_product") {
      if (!admin) return send(res, 403, { code: "42501", message: "denied" });
      if (inquiryRows.some((row) => row.product_id === body.product_uuid))
        return send(res, 409, { code: "23503", message: "related inquiries" });
      productRows = productRows.filter((row) => row.id !== body.product_uuid);
      writes.push({
        table: "products",
        method: "DELETE",
        body: { id: body.product_uuid },
      });
      return send(res, 204);
    }
    if (table === "admin_users")
      return send(res, 403, { code: "42501", message: "denied" });
    if (["POST", "PATCH", "DELETE"].includes(req.method)) {
      const publicInsert =
        req.method === "POST" &&
        ["inquiries", "newsletter_subscribers"].includes(table);
      if (!admin && !publicInsert)
        return send(res, 403, { code: "42501", message: "denied" });
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
      let rows =
        table === "products"
          ? productRows
          : table === "categories"
            ? categoryRows
            : inquiryRows;
      let changed = [];
      if (req.method === "POST") {
        if (
          ["products", "categories"].includes(table) &&
          rows.some((row) => row.slug === body.slug)
        )
          return send(res, 409, { code: "23505", message: "duplicate slug" });
        const row = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...body,
        };
        if (table !== "newsletter_subscribers") rows.push(row);
        changed = [row];
      } else {
        changed = filterRows(rows, url);
        if (req.method === "PATCH")
          for (const row of changed) Object.assign(row, body);
        if (req.method === "DELETE") {
          if (table === "categories")
            for (const row of productRows)
              if (changed.some((category) => category.id === row.category_id))
                row.category_id = null;
          rows = rows.filter((row) => !changed.includes(row));
          if (table === "categories") categoryRows = rows;
          else if (table === "products") productRows = rows;
        }
      }
      writes.push({ table, method: req.method, body });
      if (url.searchParams.has("select"))
        return send(
          res,
          req.method === "POST" ? 201 : 200,
          req.headers.accept?.includes("vnd.pgrst.object+json")
            ? changed[0]
            : changed,
        );
      return send(res, req.method === "POST" ? 201 : 204);
    }
    if (["inquiries", "newsletter_subscribers"].includes(table) && !admin)
      return send(res, 403, { code: "42501", message: "denied" });
    if (table === "products" && scenario === "error")
      return send(res, 503, {
        code: "XX000",
        message: "PRIVATE SQL ERROR MUST NOT LEAK",
      });
    let rows =
      table === "products"
        ? productRows
        : table === "categories"
          ? categoryRows
          : table === "inquiries"
            ? inquiryRows
            : [];
    rows = filterRows([...rows], url);
    const count = rows.length;
    const order = url.searchParams.get("order") || "";
    if (order.startsWith("name"))
      rows.sort((a, b) => a.name.localeCompare(b.name));
    else
      rows.sort((a, b) =>
        (order.startsWith("updated_at")
          ? b.updated_at
          : b.created_at
        ).localeCompare(
          order.startsWith("updated_at") ? a.updated_at : a.created_at,
        ),
      );
    rows = rows.slice(Number(url.searchParams.get("offset") || 0));
    if (url.searchParams.has("limit"))
      rows = rows.slice(0, Number(url.searchParams.get("limit")));
    const select = url.searchParams.get("select") || "*";
    if (table === "products")
      rows = rows.map((row) => ({
        ...row,
        category: categoryRows.find((c) => c.id === row.category_id) || null,
        images: row.images || [],
      }));
    if (table === "categories" && select.includes("products(count)"))
      rows = rows.map((row) => ({
        ...row,
        products: [
          { count: productRows.filter((p) => p.category_id === row.id).length },
        ],
      }));
    if (table === "inquiries" && select.includes("product:products"))
      rows = rows.map((row) => ({
        ...row,
        product: productRows.find((p) => p.id === row.product_id) || null,
      }));
    if (select === "id") rows = rows.map((row) => ({ id: row.id }));
    const headers = {
      "content-range": "0-" + Math.max(0, rows.length - 1) + "/" + count,
    };
    if (req.method === "HEAD") return send(res, 200, undefined, headers);
    if (req.headers.accept?.includes("vnd.pgrst.object+json"))
      return send(
        res,
        rows.length ? 200 : 406,
        rows[0] || {
          code: "PGRST116",
          details: "The result contains 0 rows",
          message: "not found",
        },
        headers,
      );
    return send(res, 200, rows, headers);
  } catch {
    send(res, 500, {
      code: "fixture_error",
      message: "Fixture request failed",
    });
  }
}).listen(4318, "127.0.0.1");
