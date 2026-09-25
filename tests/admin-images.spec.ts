import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
const control = "http://127.0.0.1:4318/__control";
const productId = "20000000-0000-4000-8000-000000000001";
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/products/${productId}/edit`);
  await expect(
    page.getByLabel("Add product images", { exact: true }),
  ).toBeEnabled();
}
test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
});

async function imageFile(name: string, color: string) {
  return {
    name,
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 90, height: 120, channels: 3, background: color },
    })
      .png()
      .toBuffer(),
  };
}

async function renderedImageSource(image: ReturnType<Page["locator"]>) {
  const src = await image.getAttribute("src");
  expect(src).toBeTruthy();
  const parsed = new URL(src!, "http://127.0.0.1:3100");
  return parsed.pathname === "/_next/image"
    ? parsed.searchParams.get("url")
    : parsed.pathname;
}

async function expectRenderedImage(
  image: ReturnType<Page["locator"]>,
  source: string,
) {
  expect(await renderedImageSource(image)).toBe(source);
  await expect
    .poll(() =>
      image.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    )
    .toBe(true);
}

test("one uploaded image is the same image on Shop, Product Details and Edit before a three-image gallery", async ({
  page,
  request,
}) => {
  await login(page);
  const first = await imageFile("single.png", "#125f75");
  await page
    .getByLabel("Add product images", { exact: true })
    .setInputFiles(first);
  await page
    .getByRole("button", { name: "UPLOAD SELECTED IMAGES", exact: true })
    .click();
  await expect(
    page.getByText("1 image uploaded.", { exact: true }),
  ).toBeVisible();

  let state = await (await request.get(control)).json();
  let product = state.products.find(
    (item: { id: string }) => item.id === productId,
  );
  expect(state.storage).toHaveLength(1);
  expect(product.images).toHaveLength(1);
  const uploaded = product.images[0];
  expect(uploaded.product_id).toBe(productId);
  expect(uploaded.sort_order).toBe(0);
  expect(uploaded.is_primary).toBe(true);
  expect(uploaded.storage_path).toBe(state.storage[0]);
  expect(uploaded.image_url).toBe(
    `http://127.0.0.1:4318/storage/v1/object/public/product-images/${uploaded.storage_path}`,
  );
  await expectRenderedImage(
    page.locator(".admin-image-preview img").first(),
    uploaded.image_url,
  );

  await page.goto("/shop");
  await expectRenderedImage(
    page
      .getByRole("link", { name: "View TEMP New Arrival", exact: true })
      .locator("img"),
    uploaded.image_url,
  );
  await page.goto("/product/temp-piece-1");
  await expectRenderedImage(
    page.locator(".gallery-image-frame img"),
    uploaded.image_url,
  );

  await page.goto(`/admin/products/${productId}/edit`);
  const additions = await Promise.all([
    imageFile("second.png", "#6c3048"),
    imageFile("third.png", "#a88135"),
  ]);
  const addInput = page
    .locator(".admin-image-editor")
    .last()
    .getByLabel("Add product images", { exact: true });
  await expect(addInput).toBeEnabled();
  await addInput.setInputFiles(additions);
  await expect(page.locator(".admin-selected-image")).toHaveCount(2);
  const uploadSelected = page.getByRole("button", {
    name: "UPLOAD SELECTED IMAGES",
    exact: true,
  });
  await expect(uploadSelected).toBeEnabled();
  await uploadSelected.click();
  await expect(
    page.getByText("2 images uploaded.", { exact: true }),
  ).toBeVisible();

  state = await (await request.get(control)).json();
  product = state.products.find(
    (item: { id: string }) => item.id === productId,
  );
  expect(product.images).toHaveLength(3);
  expect(
    product.images.map((image: { sort_order: number }) => image.sort_order),
  ).toEqual([0, 1, 2]);
  expect(
    product.images.map((image: { is_primary: boolean }) => image.is_primary),
  ).toEqual([true, false, false]);
  const editImages = await page.locator(".admin-image-preview img").all();
  expect(
    await Promise.all(editImages.map((image) => renderedImageSource(image))),
  ).toEqual(
    product.images.map((image: { image_url: string }) => image.image_url),
  );

  await page.goto("/shop");
  expect(
    await renderedImageSource(
      page
        .getByRole("link", { name: "View TEMP New Arrival", exact: true })
        .locator("img"),
    ),
  ).toBe(product.images[0].image_url);
  await page.goto("/product/temp-piece-1");
  for (const [index, image] of product.images.entries()) {
    if (index)
      await page
        .getByRole("button", { name: `Show view ${index + 1}`, exact: true })
        .click();
    await expectRenderedImage(
      page.locator(".gallery-image-frame img"),
      image.image_url,
    );
  }
});

test("admin creates a product with more than three ordered images and preserves them on text edits", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/admin/products/new");
  await page.getByLabel("Product name").fill("Four View Jacket");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption({ label: "Jackets" });
  await page.getByLabel("Price (PHP)").fill("2450");
  const files = await Promise.all([
    imageFile("front.png", "#111111"),
    imageFile("back.png", "#333333"),
    imageFile("detail.png", "#777777"),
    imageFile("label.png", "#aaaaaa"),
  ]);
  const imageInput = page.getByLabel("Add product images", { exact: true });
  await imageInput.setInputFiles(files);
  await expect(page.locator(".admin-selected-image")).toHaveCount(4);
  await expect(page.getByText("front.png", { exact: true })).toBeVisible();
  await imageInput.setInputFiles(files[0]);
  await expect(page.locator(".admin-multi-images .admin-error")).toContainText(
    "duplicate file was already selected",
  );
  await expect(page.locator(".admin-selected-image")).toHaveCount(4);
  await page.getByRole("button", { name: "SAVE PRODUCT" }).click();
  await expect(page).toHaveURL(
    /\/admin\/products\/[0-9a-f-]+\/edit\?notice=added/,
  );
  await expect(page.locator(".admin-image-cover")).toHaveCount(1);
  let state = await (await request.get(control)).json();
  let created = state.products.find(
    (product: { slug: string }) => product.slug === "four-view-jacket",
  );
  expect(created.images).toHaveLength(4);
  expect(
    created.images.map((image: { sort_order: number }) => image.sort_order),
  ).toEqual([0, 1, 2, 3]);
  expect(
    created.images.filter((image: { is_primary: boolean }) => image.is_primary),
  ).toHaveLength(1);
  expect(created.images[0].is_primary).toBe(true);
  await page.getByLabel("Color", { exact: false }).fill("Black");
  await page.getByRole("button", { name: "SAVE CHANGES" }).click();
  await expect(page).toHaveURL(/\/admin\/products\?notice=updated/);
  state = await (await request.get(control)).json();
  created = state.products.find(
    (product: { slug: string }) => product.slug === "four-view-jacket",
  );
  expect(created.images).toHaveLength(4);
});

test("edit product adds multiple images without replacing the existing gallery", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/admin/products/20000000-0000-4000-8000-000000000000/edit");
  await expect(
    page.getByText("TEMP Bestseller", { exact: true }),
  ).toBeVisible();
  const addInput = page
    .locator(".admin-image-editor")
    .last()
    .getByLabel("Add product images", { exact: true });
  await expect(addInput).toBeEnabled();
  const additions = await Promise.all([
    imageFile("inside.png", "#224466"),
    imageFile("cuff.png", "#446688"),
  ]);
  await addInput.setInputFiles(additions);
  await expect(page.locator(".admin-selected-image")).toHaveCount(2);
  await page
    .getByRole("button", { name: "UPLOAD SELECTED IMAGES", exact: true })
    .click();
  await expect(
    page.getByText("2 images uploaded.", { exact: true }),
  ).toBeVisible();
  const state = await (await request.get(control)).json();
  const product = state.products.find(
    (item: { id: string }) =>
      item.id === "20000000-0000-4000-8000-000000000000",
  );
  expect(product.images).toHaveLength(5);
  expect(
    product.images.map((image: { sort_order: number }) => image.sort_order),
  ).toEqual([0, 1, 2, 3, 4]);
});

test("storage and image-record failures are categorized and uploaded orphans are cleaned up", async ({
  page,
  request,
}) => {
  const file = await imageFile("failure.png", "#aa3344");
  await login(page);
  await request.post(control, { data: { storageFailure: true } });
  await page
    .getByLabel("Add product images", { exact: true })
    .setInputFiles(file);
  await page
    .getByRole("button", { name: "UPLOAD SELECTED IMAGES", exact: true })
    .click();
  await expect(
    page.locator(".admin-image-editor").last().getByRole("alert"),
  ).toContainText("Could not upload image");
  await request.post(control, { data: { storageFailure: false } });
  await request.post(control, { data: { imageRecordFailure: true } });
  await page
    .getByRole("button", { name: "UPLOAD SELECTED IMAGES", exact: true })
    .click();
  await expect(
    page.locator(".admin-image-editor").last().getByRole("alert"),
  ).toContainText("Could not save image record");
  const state = await (await request.get(control)).json();
  expect(state.storage).toEqual([]);
});

test("new product and uploaded file are rolled back when its image record fails", async ({
  page,
  request,
}) => {
  await login(page);
  await request.post(control, { data: { imageRecordFailure: true } });
  await page.goto("/admin/products/new");
  await page.getByLabel("Product name").fill("Rollback Test Jacket");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption({ label: "Jackets" });
  await page.getByLabel("Price (PHP)").fill("2450");
  await page
    .getByLabel("Add product images", { exact: true })
    .setInputFiles(await imageFile("rollback.png", "#532c65"));
  await expect(page.locator(".admin-selected-image")).toHaveCount(1);
  await page.getByRole("button", { name: "SAVE PRODUCT" }).click();
  await expect(page.locator(".admin-form > .admin-error")).toContainText(
    "incomplete product was rolled back",
  );

  const state = await (await request.get(control)).json();
  expect(
    state.products.some(
      (product: { slug: string }) => product.slug === "rollback-test-jacket",
    ),
  ).toBe(false);
  expect(state.storage).toEqual([]);
});

test("admin previews, uploads, edits alt text, replaces and removes images without deleting a shared photo", async ({
  page,
  request,
}) => {
  const buffer = await sharp({
    create: { width: 90, height: 120, channels: 3, background: "#aabbcc" },
  })
    .png()
    .toBuffer();
  await login(page);
  await page
    .getByLabel("Add product images", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer });
  await expect(page.locator(".admin-selected-image")).toHaveCount(1);
  await page
    .getByRole("button", { name: "UPLOAD SELECTED IMAGES", exact: true })
    .click();
  await expect(
    page.getByText("1 image uploaded.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cover image", { exact: true })).toBeVisible();
  let state = await (await request.get(control)).json();
  const uploaded = state.products.find(
    (product: { id: string }) => product.id === productId,
  ).images[0];
  expect(uploaded.storage_path).toMatch(
    /^products\/[a-f0-9-]+\/[a-f0-9-]+\.webp$/,
  );
  expect(uploaded.storage_path).not.toContain("photo.png");
  expect(uploaded.alt_text).toContain("TEMP New Arrival");
  let existing = page.locator(".admin-image-editor").first();
  await existing
    .getByLabel("Image description (alt text)")
    .fill("Hand-painted silver rose on blue denim");
  await existing
    .getByRole("button", { name: "Save image", exact: true })
    .click();
  await expect(page.getByText("Image saved.", { exact: true })).toBeVisible();
  await request.post(control, {
    data: {
      shareImage: uploaded.id,
      targetProduct: "20000000-0000-4000-8000-000000000000",
    },
  });
  existing = page.locator(".admin-image-editor").first();
  await existing
    .getByLabel("Image description (alt text)")
    .fill("Rear view of hand-painted denim");
  await existing
    .getByRole("button", { name: "Save image", exact: true })
    .click();
  await expect(existing.getByLabel("Image description (alt text)")).toHaveValue(
    "Rear view of hand-painted denim",
  );
  await expect(
    existing.getByLabel("Replace image", { exact: true }),
  ).toBeEnabled();
  await existing
    .getByLabel("Replace image", { exact: true })
    .setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer });
  await expect(
    existing.getByText("Preview ready.", { exact: false }),
  ).toBeVisible();
  await existing
    .getByRole("button", { name: "Save image", exact: true })
    .click();
  await expect(
    existing.getByText("Preview ready.", { exact: false }),
  ).toHaveCount(0);
  state = await (await request.get(control)).json();
  const replacement = state.products.find(
    (product: { id: string }) => product.id === productId,
  ).images[0];
  expect(replacement.storage_path).not.toBe(uploaded.storage_path);
  expect(state.storage).toContain(uploaded.storage_path);
  expect(state.storage).toContain(replacement.storage_path);
  existing = page.locator(".admin-image-editor").first();
  await existing
    .getByRole("button", { name: "Remove image", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "REMOVE IMAGE?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await existing
    .getByRole("button", { name: "Remove image", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await expect(page.getByText("Image removed.", { exact: true })).toBeVisible();
  state = await (await request.get(control)).json();
  expect(state.storage).toContain(uploaded.storage_path);
  expect(state.storage).not.toContain(replacement.storage_path);
});

test("admin image form rejects disguised files and rechecks membership before upload", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByLabel("Add product images", { exact: true }).setInputFiles({
    name: "disguised.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
  });
  await expect(
    page.locator(".admin-image-editor").getByRole("alert"),
  ).toContainText("contents do not match");
  expect((await (await request.get(control)).json()).storage).toEqual([]);
  const buffer = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#aabbcc" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Add product images", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer });
  await expect(page.locator(".admin-selected-image")).toHaveCount(1);
  await request.post(control, { data: { revokeMembership: true } });
  await page
    .getByRole("button", { name: "UPLOAD SELECTED IMAGES", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await (await request.get(control)).json()).storage).toEqual([]);
});
