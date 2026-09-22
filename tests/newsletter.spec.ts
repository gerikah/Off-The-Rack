import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  campaignContentSchema,
  newsletterActionSchema,
  renderNewsletter,
} from "../src/lib/newsletter/content";
import {
  hashToken,
  unsubscribeToken,
  validUnsubscribeToken,
} from "../src/lib/newsletter/tokens";

const control = "http://127.0.0.1:4318/__control";
const campaignId = "60000000-0000-4000-8000-000000000001";
const content = {
  subject: "New pieces this September",
  body: "A considered update with hand-painted jackets and custom slots.",
};
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
});

test("newsletter escapes content, rejects header injection, and requires explicit campaign confirmation", () => {
  expect(
    campaignContentSchema.safeParse({
      ...content,
      subject: "Hello\r\nBcc: intruder@example.invalid",
    }).success,
  ).toBe(false);
  expect(
    newsletterActionSchema.safeParse({
      action: "start",
      id: campaignId,
      expected_count: 3,
    }).success,
  ).toBe(false);
  const rendered = renderNewsletter(
    {
      subject: "A <new> drop",
      body: '<script>alert("x")</script>\n\nPaint & thread',
    },
    "<Studio & address>",
    "https://example.invalid/unsubscribe#safe",
  );
  expect(rendered.html).not.toContain("<script>");
  expect(rendered.html).toContain("&lt;script&gt;");
  expect(rendered.html).toContain("&lt;Studio &amp; address&gt;");
  expect(rendered.text).toContain(
    "Unsubscribe: https://example.invalid/unsubscribe#safe",
  );
});

test("unsubscribe tokens are deterministic for retries, unpredictable across recipients, and stored as hashes", () => {
  const secret = "local-only-random-fixture-secret".repeat(3);
  const token = unsubscribeToken(campaignId, secret);
  expect(validUnsubscribeToken(token)).toBe(true);
  expect(unsubscribeToken(campaignId, secret)).toBe(token);
  expect(
    unsubscribeToken("70000000-0000-4000-8000-000000000001", secret),
  ).not.toBe(token);
  expect(unsubscribeToken(campaignId, secret + "changed")).not.toBe(token);
  expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
  expect(hashToken(token)).not.toContain(token);
  for (const value of [null, "short", token + "=", "!".repeat(43)])
    expect(validUnsubscribeToken(value)).toBe(false);
});

test("newsletter API denies anonymous and revoked admin sessions without reading subscriber data", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/admin/newsletter")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin/newsletter", {
        data: { action: "create", id: campaignId, ...content },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/admin/newsletter");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page);
  await request.post(control, { data: { revokeMembership: true } });
  expect(
    await page.evaluate(
      async () => (await fetch("/api/admin/newsletter")).status,
    ),
  ).toBe(403);
  const state = await (await request.get(control)).json();
  expect(
    state.queries.filter(
      (item: { table: string }) => item.table === "newsletter_subscribers",
    ),
  ).toEqual([]);
});

test("admin saves safe drafts and verifies legacy consent only after confirmation; outbound campaigns stay disabled", async ({
  page,
  request,
}) => {
  await login(page);
  await page.goto("/admin/newsletter");
  await expect(
    page.getByRole("heading", { name: "Newsletter", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".admin-newsletter-count")).toContainText(
    "3 eligible subscribers",
  );
  await page.getByLabel("Subject *", { exact: true }).fill(content.subject);
  await page.getByLabel("Message *", { exact: true }).fill(content.body);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send test to my admin email" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review and send" }),
  ).toBeDisabled();
  const payload = {
    action: "start",
    id: campaignId,
    expected_count: 3,
    confirmed: true,
  };
  const response = await page.evaluate(async (data) => {
    const response = await fetch("/api/admin/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }, payload);
  expect(response.status).toBe(503);
  expect(response.body.error).toContain("disabled");
  await page
    .getByRole("button", { name: "Record existing consent verification" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirm", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Record existing consent verification" })
    .click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".admin-newsletter-count")).toContainText(
    "5 eligible subscribers",
  );
  const state = await (await request.get(control)).json();
  expect(state.newsletter.campaigns).toHaveLength(1);
  expect(state.newsletter.campaigns[0]).toMatchObject({
    ...content,
    status: "draft",
  });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});

test("unsubscribe requires a valid token, GET never mutates, and browser confirmation sends only its hash to storage", async ({
  page,
  request,
}) => {
  const token = unsubscribeToken(
    campaignId,
    "fixture-unsubscribe-secret".repeat(3),
  );
  const get = await request.get("/api/newsletter/unsubscribe?token=" + token);
  expect(get.ok()).toBe(true);
  expect(
    (await (await request.get(control)).json()).newsletter.unsubscribeHashes,
  ).toEqual([]);
  expect(
    (
      await request.post("/api/newsletter/unsubscribe", {
        data: { token: "invalid" },
      })
    ).status(),
  ).toBe(400);
  await page.goto("/unsubscribe#" + token);
  await expect(page).toHaveURL(/\/unsubscribe$/);
  await page
    .getByRole("button", { name: "Unsubscribe from the drop list" })
    .click();
  await expect(page.locator(".unsubscribe-panel [role=status]")).toContainText(
    "processed",
  );
  expect(
    (await (await request.get(control)).json()).newsletter.unsubscribeHashes,
  ).toEqual([hashToken(token)]);
  const oneClick = await request.post(
    "/api/newsletter/unsubscribe?token=" + token,
    { form: { "List-Unsubscribe": "One-Click" } },
  );
  expect(oneClick.ok()).toBe(true);
  const crossSite = await request.post("/api/newsletter/unsubscribe", {
    headers: { Origin: "https://untrusted.example.invalid" },
    data: { token },
  });
  expect(crossSite.status()).toBe(403);
});
