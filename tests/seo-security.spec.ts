import { test, expect } from "@playwright/test";
import { serializeJsonLd } from "../src/lib/seo";
const control = "http://127.0.0.1:4318/__control";
test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
});
test("public metadata, JSON-LD, robots and private indexing are coherent", async ({
  page,
  request,
}) => {
  const titles = new Set<string>();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  for (const path of [
    "/",
    "/shop",
    "/about",
    "/contact",
    "/archive",
    "/product/temp-piece-0",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    titles.add(await page.title());
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https:\/\/offtherack\.vercel\.app/,
    );
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(new URL(canonical!).href).toBe(
      new URL(path, "https://offtherack.vercel.app").href,
    );
    expect(
      await page.locator('meta[name="description"]').getAttribute("content"),
    ).toBeTruthy();
    expect(
      await page.locator('meta[property="og:image"]').getAttribute("content"),
    ).toBeTruthy();
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  }
  expect(titles.size).toBe(6);
  const ld = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  const graph = JSON.parse(ld!);
  expect(graph["@graph"][0]).toMatchObject({
    "@type": "Product",
    offers: {
      priceCurrency: "PHP",
      availability: "https://schema.org/InStock",
    },
  });
  expect(graph["@graph"][1]["@type"]).toBe("BreadcrumbList");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Disallow: /unsubscribe");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(
    "https://offtherack.vercel.app/product/temp-piece-0",
  );
  expect(sitemap).not.toContain("/admin");
  expect(sitemap).not.toContain("localhost");
  const response = await request.get("/admin/login");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(browserErrors).toEqual([]);
  await page.goto("/this-page-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "THIS RACK IS EMPTY." }),
  ).toBeVisible();
  expect(
    await page.locator('meta[name="robots"]').first().getAttribute("content"),
  ).toContain("noindex");
});
test("security headers and bounded form handling reject abuse without exposing details", async ({
  request,
}) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["permissions-policy"]).toContain("camera=()");
  const valid = {
    customer_name: "Test Customer",
    email: "seo-test@example.invalid",
    inquiry_type: "general",
    product_id: null,
    message: "A valid question about your pieces.",
    consent: true,
    website: "",
    started_at: Date.now() - 3000,
  };
  const foreign = await request.post("/api/inquiries", {
    data: valid,
    headers: { origin: "https://untrusted.invalid" },
  });
  expect(foreign.status()).toBe(403);
  const tooFast = await request.post("/api/inquiries", {
    data: { ...valid, started_at: Date.now() },
  });
  expect(tooFast.status()).toBe(400);
  const bot = await request.post("/api/inquiries", {
    data: { ...valid, website: "spam" },
  });
  expect(bot.status()).toBe(400);
  const large = await request.post("/api/inquiries", {
    data: { ...valid, message: "x".repeat(17000) },
  });
  expect(large.status()).toBe(413);
  const accepted = await request.post("/api/inquiries", {
    data: { ...valid, status: "resolved", created_at: "2000-01-01" },
  });
  expect(accepted.status()).toBe(201);
  const state = await (await request.get(control)).json();
  expect(state.writes[0].body.status).toBe("new");
  expect(state.writes[0].body.created_at).toBeUndefined();
});
test("structured data serialization cannot terminate an inert script", () => {
  const value = {
    name: '</script><script>alert("x")</script>',
    description: "A & B > C",
  };
  const json = serializeJsonLd(value);
  expect(json).not.toContain("<");
  expect(json).not.toContain(">");
  expect(JSON.parse(json)).toEqual(value);
});
