import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [375, 1440]) {
  test(`catalog imagery and WCAG checks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/shop",
      "/product/crimson-web-hoodie",
      "/about",
      "/contact",
      "/inquiry?type=custom",
    ]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.locator("img").evaluateAll((images) =>
        images.forEach((image) => {
          if (image instanceof HTMLImageElement) image.loading = "eager";
        }),
      );
      await page.waitForFunction(() =>
        Array.from(document.images).every((image) => image.complete),
      );
      const broken = await page
        .locator("img")
        .evaluateAll((images) =>
          images
            .filter(
              (image) =>
                image instanceof HTMLImageElement && image.naturalWidth === 0,
            )
            .map((image) => image.getAttribute("alt")),
        );
      expect(broken, `Broken images on ${route}`).toEqual([]);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations, `Accessibility on ${route}`).toEqual([]);
    }
  });
}
test("submission errors retain input and success follows a confirmed response", async ({
  page,
}) => {
  await page.goto("/inquiry");
  await page.getByLabel("Full name").fill("Preview Customer");
  await page
    .getByLabel("Email", { exact: false })
    .first()
    .fill("preview@example.com");
  await page
    .getByLabel("Message", { exact: false })
    .fill("Can you help me choose a hand-painted piece?");
  await page.getByRole("checkbox").check();
  await page.route("**/api/inquiries", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Please try again shortly." },
    }),
  );
  await page.getByRole("button", { name: "Preview inquiry" }).click();
  await expect(page.locator(".inquiry-form").getByRole("alert")).toHaveText(
    "Please try again shortly.",
  );
  await expect(page.getByLabel("Full name")).toHaveValue("Preview Customer");
  await page.unroute("**/api/inquiries");
  await page.route("**/api/inquiries", (route) =>
    route.fulfill({ status: 201, json: { mode: "live" } }),
  );
  await page.getByRole("button", { name: "Preview inquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "INQUIRY SENT." }),
  ).toBeVisible();
});
