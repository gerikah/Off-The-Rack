import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  slugify,
  productSchema,
  categorySchema,
  productTransitions,
} from "../src/lib/admin/validation";
const control = "http://127.0.0.1:4318/__control";
test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
});
async function login(page: Page, email = "admin@example.invalid") {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "LOG IN", exact: true }).click();
  if (email === "admin@example.invalid")
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
}
test("slug generation and category/product validation reject invalid data", () => {
  expect(slugify("  Black Painted Denim Jacket! ")).toBe(
    "black-painted-denim-jacket",
  );
  expect(slugify("Cafe / Chrome")).toBe("cafe-chrome");
  expect(
    categorySchema.safeParse({ name: "", slug: "UPPER SPACE", description: "" })
      .success,
  ).toBe(false);
  expect(
    categorySchema.safeParse({
      name: "Jackets",
      slug: "jackets",
      description: "",
    }).success,
  ).toBe(true);
  expect(
    productSchema.safeParse({
      name: "Test",
      slug: "test",
      price: "-1",
      category_id: "invalid",
      status: "other",
    }).success,
  ).toBe(false);
  expect(
    productSchema.safeParse({
      name: "Valid product",
      slug: "valid-product",
      category_id: "10000000-0000-4000-8000-000000000000",
      price: "0",
      status: "available",
    }).success,
  ).toBe(true);
  expect(productTransitions).toEqual({
    available: ["sold", "archived"],
    sold: ["available", "archived"],
    archived: ["available"],
  });
});
test("anonymous admin requests redirect without reading protected records", async ({
  page,
  request,
}) => {
  for (const path of [
    "/admin",
    "/admin/products",
    "/admin/products/new",
    "/admin/categories",
    "/admin/inquiries",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  await expect(
    page.getByRole("button", { name: "LOG IN", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Create Account")).toHaveCount(0);
  await expect(page.locator(".site-header")).toHaveCount(0);
  await expect(page.locator(".newsletter-section")).toHaveCount(0);
  const state = await (await request.get(control)).json();
  expect(
    state.queries.filter((query: { table: string }) =>
      ["inquiries", "admin_users"].includes(query.table),
    ),
  ).toEqual([]);
});
test("non-admin authenticated account is denied and receives no customer data", async ({
  page,
  request,
}) => {
  await login(page, "member@example.invalid");
  await expect(page.locator(".admin-root [role=alert]")).toContainText(
    "does not have admin access",
  );
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/inquiries");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.locator("body")).not.toContainText(
    "customer0@example.invalid",
  );
  const state = await (await request.get(control)).json();
  expect(state.writes).toEqual([]);
  expect(
    state.queries.filter(
      (query: { table: string }) => query.table === "inquiries",
    ),
  ).toEqual([]);
});
test("admin sees live-shaped counts, recent inquiries and login redirects", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator(".admin-stat")).toHaveCount(4);
  await expect(page.locator(".admin-stat").nth(0)).toContainText("4");
  await expect(page.locator(".admin-stat").nth(1)).toContainText("2");
  await expect(page.locator(".admin-stat").nth(3)).toContainText("3");
  await expect(page.getByText("Test Customer 0")).toBeVisible();
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/admin$/);
});
test("product form validates, auto-generates slug, creates and edits without image writes", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/admin/products/new");
  await page.getByRole("button", { name: "SAVE PRODUCT" }).click();
  await expect(page.getByLabel("Product name")).toBeFocused();
  await page.getByLabel("Product name").fill("Temporary Admin Jacket");
  await expect(page.getByLabel("Slug", { exact: false })).toHaveValue(
    "temporary-admin-jacket",
  );
  await page
    .getByLabel("Category", { exact: false })
    .selectOption({ label: "Jackets" });
  await page.getByLabel("Price (PHP)").fill("-1");
  await page
    .locator("form.admin-form")
    .evaluate((form) => ((form as HTMLFormElement).noValidate = true));
  await page.getByRole("button", { name: "SAVE PRODUCT" }).click();
  await expect(page.locator(".admin-root [role=alert]")).toContainText(
    "highlighted",
  );
  await expect(page.getByLabel("Product name")).toHaveValue(
    "Temporary Admin Jacket",
  );
  await page.getByLabel("Price (PHP)").fill("1850");
  await page.getByLabel("Slug", { exact: false }).fill("temp-piece-0");
  await page.getByRole("button", { name: "SAVE PRODUCT" }).click();
  await expect(page.locator(".admin-root [role=alert]")).toHaveText(
    "This slug is already in use.",
  );
  await page
    .getByLabel("Slug", { exact: false })
    .fill("temporary-admin-jacket");
  await page.getByLabel("Bestseller", { exact: true }).check();
  await page.getByRole("button", { name: "SAVE PRODUCT" }).click();
  await expect(page).toHaveURL(
    /\/admin\/products\/[0-9a-f-]+\/edit\?notice=added/,
  );
  await expect(
    page.getByRole("status").filter({ hasText: "PRODUCT ADDED." }),
  ).toBeVisible();
  await page.goto("/admin/products");
  const row = page
    .getByRole("row")
    .filter({ hasText: "Temporary Admin Jacket" });
  await expect(row).toContainText("PHP 1,850");
  await row.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(/\/edit$/, { timeout: 30000 });
  await expect(page.getByLabel("Price (PHP)")).toHaveValue("1850");
  await page.getByLabel("Color", { exact: false }).fill("Black");
  await page.getByRole("button", { name: "SAVE CHANGES" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "PRODUCT UPDATED." }),
  ).toBeVisible();
  const state = await (await request.get(control)).json();
  expect(
    state.products.find(
      (product: { slug: string }) => product.slug === "temporary-admin-jacket",
    ),
  ).toMatchObject({ price: 1850, color: "Black", bestseller: true });
  expect(
    state.writes.some(
      (write: { table: string }) => write.table === "product_images",
    ),
  ).toBe(false);
});
test("product search, category/status filters and confirmed status transitions", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/products");
  await page.getByLabel("Search products").fill("New Arrival");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Search products").fill("");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Pants" });
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("archived");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("");
  for (const [label, status] of [
    ["Mark sold", "sold"],
    ["Archive", "archived"],
    ["Restore to available", "available"],
  ]) {
    const row = page.getByRole("row").filter({ hasText: "TEMP New Arrival" });
    const menu = row.locator("details");
    if ((await menu.getAttribute("open")) === null)
      await menu.locator("summary").click();
    await row.getByRole("button", { name: label, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row.locator(".admin-badge")).toHaveText(status);
    await expect(page.locator(".admin-toast")).toContainText(
      status === "sold"
        ? "PRODUCT MARKED SOLD."
        : status === "archived"
          ? "PRODUCT ARCHIVED."
          : "PRODUCT RESTORED.",
    );
  }
});
test("product deletion requires confirmation and protects related inquiries", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/products");
  const row = page.getByRole("row").filter({ hasText: "TEMP Bestseller" });
  await row.locator("summary").click();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Archive it");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const removable = page
    .getByRole("row")
    .filter({ hasText: "TEMP New Arrival" });
  await removable.locator("summary").click();
  await removable.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(removable).toHaveCount(0);
});
test("categories add/edit and warn before removing a used category", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "+ ADD CATEGORY" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category name").fill("Temporary Category");
  await expect(dialog.getByLabel("Slug")).toHaveValue("temporary-category");
  await dialog.getByRole("button", { name: "SAVE CATEGORY" }).click();
  await expect(dialog).not.toBeVisible();
  let row = page.getByRole("row").filter({ hasText: "Temporary Category" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Description")
    .fill("Temporary category description.");
  await dialog.getByRole("button", { name: "SAVE CATEGORY" }).click();
  await expect(row).toContainText("Temporary category description.");
  row = page.getByRole("row").filter({ hasText: "Jackets" });
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("will become uncategorized");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const state = await (await request.get(control)).json();
  expect(
    state.categories.find(
      (category: { slug: string }) => category.slug === "temporary-category",
    ),
  ).toMatchObject({ description: "Temporary category description." });
});
test("inquiry search/filter, detail and manual status update", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/admin/inquiries");
  await page.getByLabel("Search inquiries").fill("customer1@example.invalid");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "Test Customer 1" }).click();
  await expect(page).toHaveURL(
    /\/inquiries\/30000000-0000-4000-8000-000000000001$/,
    { timeout: 30000 },
  );
  await expect(page.getByText("Silver artwork on black denim.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy email" })).toBeVisible();
  for (const status of ["replied", "resolved", "read"]) {
    await page
      .getByRole("button", {
        name: "MARK AS " + status.toUpperCase(),
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Inquiry status")).toHaveValue(status);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "INQUIRY MARKED " + status.toUpperCase() + "." }),
    ).toBeVisible();
  }
  await page.getByLabel("Inquiry status").selectOption("new");
  await page.getByRole("button", { name: "UPDATE STATUS" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "INQUIRY MARKED NEW." }),
  ).toBeVisible();
  await page.getByLabel("Inquiry status").selectOption("resolved");
  await page.getByRole("button", { name: "UPDATE STATUS" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "INQUIRY MARKED RESOLVED." }),
  ).toBeVisible();
  const state = await (await request.get(control)).json();
  expect(state.inquiries[1].status).toBe("resolved");
  await page.goto("/admin/inquiries");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("resolved");
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("revoked membership cannot mutate from a previously loaded form", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/admin/products/20000000-0000-4000-8000-000000000001/edit");
  await page.getByLabel("Product name").fill("Unauthorized change");
  await request.post(control, { data: { revokeMembership: true } });
  await page.getByRole("button", { name: "SAVE CHANGES" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByRole("heading", { name: "Access not granted" }),
  ).toBeVisible();
  const state = await (await request.get(control)).json();
  expect(state.writes).toEqual([]);
});
test("logout ends access and stale forms cannot save after cookies are cleared", async ({
  page,
  context,
  request,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page);
  await page.goto("/admin/products/20000000-0000-4000-8000-000000000001/edit");
  await context.clearCookies();
  await page.getByRole("button", { name: "SAVE CHANGES" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  const state = await (await request.get(control)).json();
  expect(state.writes).toEqual([]);
});
for (const width of [375, 768, 1440])
  test(
    "admin responsive screens and accessibility at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await login(page);
      for (const path of [
        "/admin",
        "/admin/products",
        "/admin/products/new",
        "/admin/categories",
        "/admin/inquiries",
        "/admin/inquiries/30000000-0000-4000-8000-000000000001",
      ]) {
        await page.goto(path);
        await page.locator("h1").waitFor();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          path,
        ).toBe(true);
        if (width === 1440 || width === 375) {
          await page.screenshot({
            path: `.work/admin/${width}-${path.replaceAll("/", "_")}.png`,
            fullPage: true,
          });
        }
        const scan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(scan.violations, path).toEqual([]);
      }
      if (width < 900) {
        await page
          .getByRole("button", { name: "Open admin navigation" })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).not.toBeVisible();
        await expect(
          page.getByRole("button", { name: "Open admin navigation" }),
        ).toBeFocused();
      }
    },
  );
test("admin empty states remain useful", async ({ page, request }) => {
  await request.post(control, { data: { scenario: "empty" } });
  await login(page);
  await page.goto("/admin/products");
  await expect(page.getByText("NO PRODUCTS YET.")).toBeVisible();
  await page.goto("/admin/inquiries");
  await expect(page.getByText("NO INQUIRIES YET.")).toBeVisible();
});
