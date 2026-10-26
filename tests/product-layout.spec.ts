import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { productSchema } from "../src/lib/admin/validation";
import { PRODUCT_TEXT_LIMITS } from "../src/lib/catalog/product-limits";

test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:4318/__control", {
    data: { scenario: "populated" },
  });
});

test("product copy limits accept the boundary and reject longer submissions", () => {
  const product = {
    name: "Painted denim jacket",
    slug: "painted-denim-jacket",
    category_id: "10000000-0000-4000-8000-000000000000",
    price: "2400",
    status: "available",
  };
  for (const [field, limit] of Object.entries(PRODUCT_TEXT_LIMITS)) {
    expect(
      productSchema.safeParse({ ...product, [field]: "a".repeat(limit) })
        .success,
    ).toBe(true);
    expect(
      productSchema.safeParse({ ...product, [field]: "a".repeat(limit + 1) })
        .success,
    ).toBe(false);
  }
});

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
  [375, 667],
]) {
  test(`square gallery and ordered product details at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/product/temp-piece-0");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to collection" }),
    ).toBeVisible();
    await expect(
      page.locator(
        ".newsletter-section, .site-footer, .product-related-section",
      ),
    ).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    }));
    expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewport);
    const info = page.locator(".product-detail-info");
    expect(
      await info.evaluate((el) => el.scrollHeight - el.clientHeight),
    ).toBeLessThanOrEqual(1);
    const similarBox = await page
      .locator(".product-similar-link")
      .boundingBox();
    expect(similarBox!.y + similarBox!.height).toBeLessThanOrEqual(height);
    const primary = await page.locator(".gallery-primary").boundingBox();
    expect(Math.abs(primary!.width - primary!.height)).toBeLessThan(1);
    for (const thumbnail of await page
      .locator(".gallery-thumbnails button")
      .all()) {
      const box = await thumbnail.boundingBox();
      expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
      expect(box!.y).toBeGreaterThanOrEqual(primary!.y + primary!.height);
    }
    const layout = await page
      .locator(".product-detail-info")
      .evaluate((info) => {
        const rect = (selector: string) =>
          info.querySelector(selector)!.getBoundingClientRect();
        const selectors = [
          "h1",
          ".detail-price",
          ".product-description",
          ".product-actions-wrap",
          ".product-facts",
          ".product-care",
          ".product-similar-link",
        ];
        return {
          tops: selectors.map((selector) => rect(selector).top),
          left: info.getBoundingClientRect().left,
          width: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        };
      });
    expect(layout.tops).toEqual([...layout.tops].sort((a, b) => a - b));
    expect(layout.width).toBeLessThanOrEqual(layout.viewport);
    if (width >= 768)
      expect(layout.left).toBeGreaterThan(primary!.x + primary!.width);
    await expect(page.locator(".product-facts dt")).toHaveText([
      "Size",
      "Condition",
      "Availability",
    ]);
    await expect(page.locator(".product-care")).toContainText(
      "Hand wash cold.",
    );
    await page
      .getByRole("button", { name: "Show view 3", exact: true })
      .click();
    await expect(page.locator(".gallery-primary img")).toHaveAttribute(
      "alt",
      /Fixture view 2/,
    );
    await expect(
      page.getByRole("link", { name: "View similar products" }),
    ).toHaveAttribute("href", "/shop?status=available");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({
      path: `.work/product-layout-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Back to collection" }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.locator(".newsletter-section")).toBeVisible();
    await expect(page.locator(".product-screen")).toHaveCount(0);
  });
}

test("product editor shows and enforces the shared copy limits", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/products/new");
  await expect(page.locator(".admin-copy-limits")).toContainText(
    "Product title: up to 60 characters.",
  );
  await expect(page.locator(".admin-copy-limits")).toContainText(
    "Description: up to 240 characters.",
  );
  for (const [name, limit] of Object.entries(PRODUCT_TEXT_LIMITS)) {
    const input = page.locator(`#product-${name}`);
    await expect(input).toHaveAttribute("maxlength", String(limit));
    await input.fill("a".repeat(limit + 1));
    await expect(input).toHaveValue("a".repeat(limit));
    await expect(page.locator(`#${name}-count`)).toHaveText(
      `${limit} / ${limit} characters`,
    );
  }
});
