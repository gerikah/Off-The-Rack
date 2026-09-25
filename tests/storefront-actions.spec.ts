import { expect, test } from "@playwright/test";

const control = "http://127.0.0.1:4318/__control";
const storageKey = "off-the-rack:saved-products:v1";

test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
});

test("saved pieces persist across pages, synchronize tabs and can be removed", async ({
  page,
  context,
}) => {
  await page.goto("/shop");
  await page
    .getByRole("button", { name: "Save TEMP Bestseller", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Saved pieces (1)", exact: true })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(
    page.getByText("Saved on this device. Saving a piece does not reserve it."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Saved pieces (1)", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/product/temp-piece-0");
  await other
    .getByRole("button", {
      name: "Remove TEMP Bestseller from saved pieces",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved pieces (0)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Saved pieces (0)", exact: true })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(
    page.getByText(/Save a piece with the bookmark button/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Save TEMP Bestseller", exact: true })
    .click();
  await other.evaluate((key) => localStorage.removeItem(key), storageKey);
  await expect(
    page.getByRole("button", { name: "Saved pieces (0)", exact: true }),
  ).toBeVisible();
});

test("active filters are individually removable while results remain", async ({
  page,
}) => {
  await page.goto("/shop");
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search pieces" })
    .fill("Bestseller");
  await page
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("low");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Remove Search: Bestseller filter",
      exact: true,
    })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await expect(page.getByRole("group", { name: "Active filters" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("combobox", { name: "Sort by", exact: true }),
  ).toHaveValue("newest");
});

test("invalid or blocked local storage does not break saving", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "not-json");
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      },
    });
  }, storageKey);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/shop");
  await page
    .getByRole("button", { name: "Save TEMP Bestseller", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove TEMP Bestseller from saved pieces",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Saved pieces (1)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("TEMP Bestseller saved for this visit."),
  ).toHaveText("TEMP Bestseller saved for this visit.");
  expect(errors).toEqual([]);
});

test("gallery supports previous, next, arrow and endpoint keyboard controls", async ({
  page,
}) => {
  await page.goto("/product/temp-piece-0");
  await page
    .getByRole("button", { name: "Next product view", exact: true })
    .click();
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "alt",
    /Fixture view 1/,
  );
  await page
    .getByRole("button", { name: "Previous product view", exact: true })
    .click();
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "alt",
    /Fixture view 0/,
  );
  await page
    .getByRole("group", { name: "Product image gallery", exact: true })
    .focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "alt",
    /Fixture view 2/,
  );
  await page.keyboard.press("Home");
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "alt",
    /Fixture view 0/,
  );
  await page.keyboard.press("End");
  await expect(page.locator(".gallery-primary img")).toHaveAttribute(
    "alt",
    /Fixture view 2/,
  );
  await page.getByRole("button", { name: "Show view 2", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Show view 3", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Show view 3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("share copies the canonical piece link and offers a manual fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem("copied-product-link", value);
        },
      },
      configurable: true,
    });
  });
  await page.goto("/product/temp-piece-0?ref=untrusted");
  await page.getByRole("button", { name: "Share piece", exact: true }).click();
  await expect(page.getByText("Link copied. Ready to share.")).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("copied-product-link")),
  ).toBe("http://127.0.0.1:3100/product/temp-piece-0");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Share piece", exact: true }).click();
  await expect(page.getByLabel("Product link", { exact: true })).toHaveValue(
    "http://127.0.0.1:3100/product/temp-piece-0",
  );
  await expect(
    page.getByText("Select and copy the link below to share this piece."),
  ).toBeVisible();
});

test("mobile menu restores focus, closes at desktop width and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/shop");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "OFF THE RACK / INDEX" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/product/temp-piece-0");
  expect(
    await page
      .locator(".gallery-image-frame")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(
    await page
      .locator(".gallery-controls button")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
});
