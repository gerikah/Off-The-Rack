import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/shop",
  "/product/crimson-web-hoodie",
  "/about",
  "/contact",
  "/inquiry?type=custom",
];
for (const width of [375, 430, 768, 1024, 1440, 1920]) {
  test(`routes render without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await page.locator("h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(
        dimensions.content,
        `${route} overflows at ${width}px`,
      ).toBeLessThanOrEqual(dimensions.viewport + 1);
      await expect(page.locator("main")).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
test("shop availability, category, search, sorting and reset", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(page.locator(".product-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(7);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Tops");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card")).toContainText("Webhead Tee");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Pants");
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("low");
  await expect(page.locator(".product-card").first()).toContainText(
    "Webhead Tee",
  );
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("high");
  await expect(page.locator(".product-card").first()).toContainText(
    "PHP 3,400",
  );
  await page.getByRole("searchbox", { name: "Search pieces" }).fill("Crimson");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search pieces" }).fill("");
  await page
    .getByRole("button", { name: "Sold / archive", exact: true })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(5);
});
test("gallery and product inquiry preserve the selected piece", async ({
  page,
}) => {
  await page.goto("/product/crimson-web-hoodie");
  await page.getByRole("button", { name: "Show view 2" }).click();
  await expect(page.locator(".gallery-counter")).toHaveText("02 / 02");
  await page.locator("summary").filter({ hasText: "Measurements" }).click();
  await expect(page.getByText("Chest (laid flat)")).toBeVisible();
  await page.getByRole("link", { name: "Inquire about this piece" }).click();
  await expect(page).toHaveURL(/inquiry\?product=crimson-web-hoodie/);
  await expect(page.locator(".selected-product")).toContainText(
    "Crimson Web Hoodie",
  );
  await expect(page.getByLabel("Inquiry type")).toHaveValue("product");
  await page.getByLabel("Full name").fill("Preview Customer");
  await page
    .getByLabel("Email", { exact: false })
    .first()
    .fill("preview@example.com");
  await page
    .getByLabel("Message", { exact: false })
    .fill("Please confirm the measurements for this piece.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Preview inquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "INQUIRY PREPARED." }),
  ).toBeVisible();
  await expect(
    page.getByText("Your inquiry hasn’t been sent or saved.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "INQUIRY SENT." }),
  ).toHaveCount(0);
});
test("custom fields, validation and newsletter preview", async ({ page }) => {
  await page.goto("/inquiry?type=custom");
  await expect(page.getByLabel("Design idea")).toBeVisible();
  await page.getByRole("button", { name: "Preview inquiry" }).click();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByLabel("Full name").fill("Preview Customer");
  await page
    .getByLabel("Email", { exact: false })
    .first()
    .fill("preview@example.com");
  await page
    .getByLabel("Design idea")
    .fill("Silver artwork over a black denim jacket.");
  await page
    .getByLabel("Message", { exact: false })
    .fill("I would like to discuss a custom jacket.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Preview inquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "INQUIRY PREPARED." }),
  ).toBeVisible();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("preview@example.com");
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await expect(
    page.locator(".newsletter-form-wrap [role=status]"),
  ).toContainText("hasn’t been subscribed");
});
test("mobile menu keyboard escape and navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: /Shop/ })
    .click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("sold CTA, unknown pieces, reserved admin and reduced motion", async ({
  page,
}) => {
  await page.goto("/product/scarlet-spider-jacket");
  await expect(
    page.getByRole("link", { name: "View available pieces" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inquire about this piece" }),
  ).toHaveCount(0);
  await page.goto("/product/not-a-real-piece");
  await expect(
    page.getByRole("heading", { name: "THIS RACK IS EMPTY." }),
  ).toBeVisible();
  await page.goto("/admin/products/new");
  await expect(
    page.getByRole("heading", { name: "THIS RACK IS EMPTY." }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page
      .locator(".marquee-track")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
test("API rejects invalid submissions and reports preview honestly", async ({
  request,
}) => {
  const invalid = await request.post("/api/inquiries", {
    data: { email: "broken" },
  });
  expect(invalid.status()).toBe(400);
  const malformed = await request.post("/api/newsletter", { data: "{" });
  expect(malformed.status()).toBe(400);
  const honeypot = await request.post("/api/newsletter", {
    data: { email: "preview@example.com", website: "spam" },
  });
  expect(honeypot.status()).toBe(400);
  const preview = await request.post("/api/newsletter", {
    data: { email: "preview@example.com", website: "" },
  });
  expect(await preview.json()).toEqual({ mode: "preview" });
});
