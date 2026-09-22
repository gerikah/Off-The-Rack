// Read-only production checks. Never outputs keys, addresses, ids or response bodies.
import fs from "node:fs";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l))
    .map((l) => [
      l.slice(0, l.indexOf("=")),
      l
        .slice(l.indexOf("=") + 1)
        .trim()
        .replace(/^['"]|['"]$/g, ""),
    ]),
);
const base = "https://offtherack.vercel.app";
for (const route of [
  "/",
  "/shop",
  "/about",
  "/contact",
  "/archive",
  "/admin/products?notice=added",
  "/robots.txt",
  "/sitemap.xml",
  "/not-a-real-page",
]) {
  const r = await fetch(base + route, { signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  console.log(
    JSON.stringify({
      route,
      status: r.status,
      finalPath: new URL(r.url).pathname,
      bytes: Buffer.byteLength(text),
      title: text.match(/<title>(.*?)<\/title>/)?.[1],
      h1Count: (text.match(/<h1[ >]/g) || []).length,
      canonical: !!text.match(/rel="canonical"/),
      jsonLd: text.includes("application/ld+json"),
      noindex: text.includes("noindex"),
      csp: !!r.headers.get("content-security-policy"),
    }),
  );
}
const key =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (key && env.NEXT_PUBLIC_SUPABASE_URL) {
  const headers = { apikey: key, Authorization: "Bearer " + key };
  for (const table of [
    "products",
    "categories",
    "product_images",
    "inquiries",
    "newsletter_subscribers",
    "admin_users",
  ]) {
    const r = await fetch(
      env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/" + table + "?select=id&limit=1",
      { headers, signal: AbortSignal.timeout(15000) },
    );
    const body = await r.json();
    console.log(
      JSON.stringify({
        table,
        status: r.status,
        visibleRows: Array.isArray(body) ? body.length : null,
      }),
    );
  }
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/", {
    headers: { ...headers, Accept: "application/openapi+json" },
    signal: AbortSignal.timeout(15000),
  });
  const schema = await r.json();
  console.log(
    JSON.stringify({
      publicSchemaStatus: r.status,
      definitions: Object.fromEntries(
        Object.entries(schema.definitions || {}).map(([name, def]) => [
          name,
          Object.keys(def.properties || {}),
        ]),
      ),
    }),
  );
}
