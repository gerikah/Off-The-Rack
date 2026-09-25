import { expect, test, type Page } from "@playwright/test";
const control = "http://127.0.0.1:4318/__control";
test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
});
for (const width of [375, 430, 768, 1024, 1440, 1920]) {
  test("routes fit at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of [
      "/",
      "/shop",
      "/archive",
      "/product/temp-piece-0",
      "/about",
      "/contact",
      "/inquiry?type=custom",
    ]) {
      await page.goto(route);
      await page.locator("h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        route,
      ).toBe(true);
      await expect(page.locator("main")).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
test("empty catalog retains page composition and custom CTA", async ({
  page,
  request,
}) => {
  await request.post(control, { data: { scenario: "empty" } });
  await page.goto("/");
  await expect(page.getByText("NEW PIECES COMING SOON.")).toBeVisible();
  await expect(page.getByText("No bestseller products yet.")).toBeVisible();
  await expect(page.locator(".custom-tile")).toHaveAttribute(
    "href",
    "/inquiry?type=custom",
  );
  await page.goto("/shop");
  await expect(page.getByText("THE RACK IS CURRENTLY EMPTY.")).toBeVisible();
  await page.goto("/archive");
  await expect(
    page.getByText("THE ARCHIVE IS JUST GETTING STARTED."),
  ).toBeVisible();
  await page.goto("/product/non-existent-slug");
  await expect(
    page.getByRole("heading", { name: "THIS RACK IS EMPTY." }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/,
  );
});
test("arrivals, bestsellers and archive use their database predicates", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".arrival-products .product-card")).toHaveCount(2);
  await expect(
    page.locator(".arrival-products .product-card").first(),
  ).toContainText("TEMP New Arrival");
  await expect(page.locator(".featured-grid .product-card")).toHaveCount(2);
  await expect(page.locator(".featured-grid")).toContainText("TEMP Sold");
  await expect(page.locator(".featured-grid")).not.toContainText(
    "TEMP Archived",
  );
  await page.goto("/archive");
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(page.locator(".product-card").first()).toContainText(
    "TEMP Archived",
  );
});
test("shop filters and sorting stay within the current page", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(page.locator(".product-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Pants" });
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Tops" });
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("low");
  await expect(page.locator(".product-card").first()).toContainText(
    "TEMP New Arrival",
  );
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("high");
  await expect(page.locator(".product-card").first()).toContainText(
    "TEMP Sold",
  );
  await page
    .getByRole("searchbox", { name: "Search pieces" })
    .fill("Bestseller");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search pieces" }).fill("");
  await page
    .getByRole("button", { name: "Sold / archive", exact: true })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(page).toHaveURL(/\/shop$/);
});
async function fillInquiry(page: Page) {
  const form = page.locator(".inquiry-form");
  await form.getByLabel("Full name").fill("Integration Test");
  await form
    .locator("input[name=email]")
    .first()
    .fill("integration@example.invalid");
  await form
    .getByLabel("Message", { exact: false })
    .fill("Temporary integration test inquiry.");
  await form.getByRole("checkbox").check();
  // Exercise the real server timing protection at a human submission pace.
  await page.waitForTimeout(1_300);
}
test("gallery order, optional metadata, related pieces and product association", async ({
  page,
  request,
}) => {
  await page.goto("/product/temp-piece-0");
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "alt",
    /Fixture view 0/,
  );
  await page.getByRole("button", { name: "Show view 2" }).click();
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "alt",
    /Fixture view 1/,
  );
  await expect(page.locator(".related-section")).not.toContainText(
    "TEMP Bestseller",
  );
  await page.getByRole("link", { name: "Inquire about this piece" }).click();
  await expect(page.locator(".selected-product")).toContainText(
    "TEMP Bestseller",
  );
  await fillInquiry(page);
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "INQUIRY SENT." }),
  ).toBeVisible();
  const state = await (await request.get(control)).json();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({
    inquiry_type: "product",
    product_id: "20000000-0000-4000-8000-000000000000",
    status: "new",
  });
  expect(state.writes[0].body).not.toHaveProperty("consent");
  await page.goto("/product/temp-piece-1");
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "src",
    /background/,
  );
  await expect(page.locator("dt", { hasText: "Material" })).toHaveCount(0);
  await expect(
    page.locator("summary", { hasText: "Measurements" }),
  ).toHaveCount(0);
  await page.goto("/product/temp-piece-2");
  await expect(
    page.getByRole("link", { name: "View similar pieces" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inquire about this piece" }),
  ).toHaveCount(0);
});
test("custom validation, saved fields, newsletter success and duplicate", async ({
  page,
  request,
}) => {
  await page.goto("/inquiry?type=custom");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await fillInquiry(page);
  await page
    .getByLabel("Design idea")
    .fill("Temporary silver artwork integration test.");
  await page.getByLabel("Garment type").selectOption("Denim jacket");
  await page.getByLabel("Preferred size").fill("L");
  await page
    .getByLabel("Reference URL")
    .fill("https://example.invalid/reference");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "INQUIRY SENT." }),
  ).toBeVisible();
  const state = await (await request.get(control)).json();
  expect(state.writes[0].body).toMatchObject({
    inquiry_type: "custom",
    product_id: null,
    garment_type: "Denim jacket",
    preferred_size: "L",
    reference_url: "https://example.invalid/reference",
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await page
      .getByLabel("Email address", { exact: true })
      .fill("integration@example.invalid");
    await page.locator(".newsletter-form").getByRole("checkbox").check();
    await page.waitForTimeout(1_300);
    await page.getByRole("button", { name: /^subscribe$/i }).click();
    await expect(
      page.locator(".newsletter-form-wrap [role=status]"),
    ).toContainText(
      attempt === 0 ? "YOU'RE ON THE LIST." : "YOU'RE ALREADY ON THE LIST.",
    );
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
      "",
    );
  }
  const final = await (await request.get(control)).json();
  expect(
    final.writes.filter(
      (w: { table: string }) => w.table === "newsletter_subscribers",
    ),
  ).toHaveLength(1);
});
test("errors are branded and invalid submissions never reach customer tables", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post("/api/inquiries", { data: { email: "broken" } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/newsletter", { data: { email: "broken" } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/newsletter", {
        data: { email: "integration@example.invalid", website: "spam" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/inquiries", {
        data: {
          customer_name: "Test User",
          email: "integration@example.invalid",
          inquiry_type: "product",
          product_id: null,
          message: "Temporary test message",
          consent: true,
        },
      })
    ).status(),
  ).toBe(400);
  await request.post(control, { data: { scenario: "error" } });
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: "BACK IN A MOMENT." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE SQL");
  await page.goto("/inquiry");
  await fillInquiry(page);
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page.locator(".inquiry-form [role=alert]")).toContainText(
    "try again",
  );
  await expect(page.getByLabel("Full name")).toHaveValue("Integration Test");
  await expect(page.locator("body")).not.toContainText("PRIVATE SQL");
});
test("mobile menu and removed demo route", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  for (const route of ["/todos"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "THIS RACK IS EMPTY." }),
    ).toBeVisible();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page
      .locator(".marquee-track")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("general inquiry prevents repeated-click submissions while pending", async ({
  page,
  request,
}) => {
  await page.goto("/inquiry");
  await fillInquiry(page);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/inquiries", async (route) => {
    requests++;
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page.getByRole("button", { name: "SENDING..." })).toBeDisabled();
  await page.locator(".inquiry-form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  release?.();
  await expect(
    page.getByRole("heading", { name: "INQUIRY SENT." }),
  ).toBeVisible();
  expect(requests).toBe(1);
  const state = await (await request.get(control)).json();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({
    inquiry_type: "general",
    product_id: null,
    garment_type: null,
    design_idea: null,
  });
});
