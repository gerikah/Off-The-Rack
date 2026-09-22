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
  await expect(page.getByLabel("Add an image", { exact: true })).toBeEnabled();
}
test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
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
    .getByLabel("Add an image", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer });
  await expect(
    page.getByText("Preview ready.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Image description (alt text)", { exact: true })
    .fill("Hand-painted silver rose on blue denim");
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(page.getByText("Cover image", { exact: true })).toBeVisible();
  let state = await (await request.get(control)).json();
  const uploaded = state.products.find(
    (product: { id: string }) => product.id === productId,
  ).images[0];
  expect(uploaded.storage_path).toMatch(
    /^products\/[a-f0-9-]+\/[a-f0-9-]+\.webp$/,
  );
  expect(uploaded.storage_path).not.toContain("photo.png");
  expect(uploaded.alt_text).toContain("silver rose");
  await request.post(control, {
    data: {
      shareImage: uploaded.id,
      targetProduct: "20000000-0000-4000-8000-000000000000",
    },
  });
  let existing = page.locator(".admin-image-editor").first();
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
  await page.getByLabel("Add an image", { exact: true }).setInputFiles({
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
    .getByLabel("Add an image", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer });
  await expect(
    page.getByText("Preview ready.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Image description (alt text)", { exact: true })
    .fill("Painted flower detail");
  await request.post(control, { data: { revokeMembership: true } });
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await (await request.get(control)).json()).storage).toEqual([]);
});
