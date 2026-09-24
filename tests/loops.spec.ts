import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const control = "http://127.0.0.1:4318/__control";
const signup = (email = "loops@example.invalid") => ({
  email,
  consent: true,
  website: "",
  started_at: Date.now() - 3000,
});
const inquiry = (type = "general") => ({
  customer_name: "Fixture Customer",
  email: "inquiry@example.invalid",
  inquiry_type: type,
  product_id:
    type === "product" ? "20000000-0000-4000-8000-000000000000" : null,
  message: "Please share details about this piece.",
  design_idea: type === "custom" ? "Silver artwork on a denim jacket." : "",
  consent: true,
  website: "",
  started_at: Date.now() - 3000,
});
test.beforeEach(async ({ request }) => {
  await request.post(control, { data: { scenario: "populated" } });
});

test("newsletter normalizes, persists, upserts Loops and triggers one marketing welcome", async ({
  request,
}) => {
  const response = await request.post("/api/newsletter", {
    data: signup("  NEW@EXAMPLE.INVALID  "),
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    status: "subscribed",
    emailStatus: "accepted",
  });
  const state = await (await request.get(control)).json();
  expect(state.loops.subscribers).toContainEqual(
    expect.objectContaining({ email: "new@example.invalid", is_active: true }),
  );
  expect(state.loops.calls).toHaveLength(2);
  expect(state.loops.calls[0]).toMatchObject({
    kind: "contact",
    method: "PUT",
    body: {
      email: "new@example.invalid",
      subscribed: true,
      mailingLists: { "fixture-drop-list": true },
    },
  });
  expect(state.loops.calls[1]).toMatchObject({
    kind: "welcome",
    method: "POST",
    body: {
      eventName: "otr_newsletter_subscribed",
      eventProperties: { shopUrl: "https://offtherack.vercel.app/shop" },
    },
  });
  expect(state.loops.calls[1].idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
  const duplicate = await request.post("/api/newsletter", {
    data: signup("new@example.invalid"),
  });
  expect(await duplicate.json()).toMatchObject({
    status: "already_subscribed",
    emailStatus: "unchanged",
  });
  expect((await (await request.get(control)).json()).loops.calls).toHaveLength(
    2,
  );
});

test("existing contacts sync without another welcome and inactive subscribers reactivate", async ({
  request,
}) => {
  const active = await request.post("/api/newsletter", {
    data: signup("active@example.invalid"),
  });
  expect(await active.json()).toMatchObject({
    status: "already_subscribed",
    emailStatus: "accepted",
  });
  const inactive = await request.post("/api/newsletter", {
    data: signup("inactive@example.invalid"),
  });
  expect(await inactive.json()).toMatchObject({
    status: "reactivated",
    emailStatus: "accepted",
  });
  const state = await (await request.get(control)).json();
  expect(
    state.loops.subscribers.filter(
      (s: { email: string }) => s.email === "inactive@example.invalid",
    ),
  ).toEqual([expect.objectContaining({ is_active: true })]);
  expect(
    state.loops.calls.filter((c: { kind: string }) => c.kind === "welcome"),
  ).toHaveLength(1);
});

test("parallel newsletter requests produce one record and one welcome", async ({
  request,
}) => {
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      request.post("/api/newsletter", { data: signup() }),
    ),
  );
  expect(responses.every((response) => response.ok())).toBe(true);
  const state = await (await request.get(control)).json();
  expect(
    state.loops.subscribers.filter(
      (s: { email: string }) => s.email === "loops@example.invalid",
    ),
  ).toHaveLength(1);
  expect(
    state.loops.calls.filter((c: { kind: string }) => c.kind === "welcome"),
  ).toHaveLength(1);
});

test("invalid consent, email and failed persistence cannot call Loops", async ({
  request,
}) => {
  for (const data of [signup("invalid"), { ...signup(), consent: false }]) {
    expect((await request.post("/api/newsletter", { data })).status()).toBe(
      400,
    );
  }
  await request.post(control, { data: { scenario: "error" } });
  expect(
    (await request.post("/api/newsletter", { data: signup() })).status(),
  ).toBe(503);
  expect(
    (await request.post("/api/inquiries", { data: inquiry() })).status(),
  ).toBe(503);
  expect((await (await request.get(control)).json()).loops.calls).toEqual([]);
});

for (const fault of [
  { contactStatus: 503 },
  { contactStatus: 401 },
  { contactStatus: 429 },
  { welcomeStatus: 503 },
  { malformed: true },
  { delay: 4500 },
]) {
  test(`provider failure preserves signup with safe partial success: ${JSON.stringify(fault)}`, async ({
    request,
  }) => {
    await request.post(control, { data: { loops: fault } });
    const response = await request.post("/api/newsletter", { data: signup() });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      mode: "live",
      status: "subscribed",
      emailStatus: "pending",
    });
    const state = await (await request.get(control)).json();
    expect(state.loops.subscribers).toContainEqual(
      expect.objectContaining({
        email: "loops@example.invalid",
        is_active: true,
      }),
    );
  });
}

for (const type of ["product", "custom", "general"]) {
  test(`${type} inquiry saves then sends transactional confirmation without marketing opt-in`, async ({
    request,
  }) => {
    const response = await request.post("/api/inquiries", {
      data: inquiry(type),
    });
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({ emailStatus: "accepted" });
    const state = await (await request.get(control)).json();
    expect(
      state.writes.filter((w: { table: string }) => w.table === "inquiries"),
    ).toHaveLength(1);
    expect(state.loops.calls).toHaveLength(2);
    const customer = state.loops.calls.find(
      (c: { body: { email: string } }) =>
        c.body.email === "inquiry@example.invalid",
    );
    expect(customer).toMatchObject({
      kind: "transactional",
      body: {
        transactionalId: "fixture-inquiry-template",
        addToAudience: false,
        dataVariables: { inquiryType: type },
      },
    });
    expect(customer.body.dataVariables).not.toHaveProperty("status");
    if (type === "product")
      expect(customer.body.dataVariables).toMatchObject({
        productName: "TEMP Bestseller",
        productUrl: "https://offtherack.vercel.app/product/temp-piece-0",
      });
    if (type === "custom")
      expect(customer.body.dataVariables.requestHeading).toBe(
        "CUSTOM PIECE REQUEST RECEIVED",
      );
    expect(state.loops.contacts).toEqual([]);
    const internal = state.loops.calls.find(
      (c: { body: { email: string } }) =>
        c.body.email === "admin-notifications@example.invalid",
    );
    expect(internal).toMatchObject({
      kind: "transactional",
      body: {
        transactionalId: "fixture-admin-template",
        addToAudience: false,
        dataVariables: {
          customerName: "Fixture Customer",
          customerEmail: "inquiry@example.invalid",
        },
      },
    });
  });
}

test("failed inquiry confirmation leaves the inquiry saved and returns success", async ({
  request,
}) => {
  await request.post(control, {
    data: { loops: { transactionalStatus: 503 } },
  });
  const response = await request.post("/api/inquiries", { data: inquiry() });
  expect(response.status()).toBe(201);
  expect(await response.json()).toEqual({
    mode: "live",
    emailStatus: "pending",
  });
  expect((await (await request.get(control)).json()).writes).toHaveLength(1);
});

test("newsletter loading blocks repeat submissions, holds button geometry and announces result", async ({
  page,
  request,
}) => {
  await request.post(control, { data: { loops: { delay: 800 } } });
  await page.goto("/");
  const form = page.locator(".newsletter-form");
  await form.getByLabel("Email address").fill("loading@example.invalid");
  await form.getByRole("checkbox").check();
  await page.waitForTimeout(1300);
  const button = form.getByRole("button");
  const before = await button.boundingBox();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveText(/JOINING/);
  await expect(button).toBeDisabled();
  expect(await button.boundingBox()).toEqual(before);
  await form.evaluate((element) => {
    element.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect(page.locator("#newsletter-feedback")).toContainText(
    "YOU'RE ON THE LIST.",
  );
  expect(
    (await (await request.get(control)).json()).loops.calls.filter(
      (c: { kind: string }) => c.kind === "welcome",
    ),
  ).toHaveLength(1);
});

test("newsletter failure retains input and partial success is explicit", async ({
  page,
  request,
}) => {
  await request.post(control, { data: { scenario: "error" } });
  await page.goto("/about");
  const form = page.locator(".newsletter-form");
  await form.getByLabel("Email address").fill("failure@example.invalid");
  await form.getByRole("checkbox").check();
  await page.waitForTimeout(1300);
  await form.getByRole("button").click();
  await expect(page.locator("#newsletter-feedback")).toContainText(
    "COULDN'T ADD YOU TO THE LIST.",
  );
  await expect(form.getByLabel("Email address")).toHaveValue(
    "failure@example.invalid",
  );
  await request.post(control, { data: { scenario: "populated" } });
  await request.post(control, { data: { loops: { contactStatus: 503 } } });
  await form.getByRole("button").click();
  await expect(page.locator("#newsletter-feedback")).toContainText(
    "Your subscription is saved",
  );
});

for (const width of [375, 430, 768, 1024, 1440]) {
  test(`newsletter layout and accessibility at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const section = page.locator(".newsletter-section");
    await section.scrollIntoViewIfNeeded();
    const input = await section.locator('input[type="email"]').boundingBox();
    const button = await section.getByRole("button").boundingBox();
    expect(input!.height).toBeGreaterThanOrEqual(44);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    if (width < 600)
      expect(button!.y).toBeGreaterThanOrEqual(input!.y + input!.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".newsletter-section")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await section.screenshot({ path: `test-results/newsletter-${width}.png` });
  });
}

test("production browser assets exclude Loops credentials and server email code", () => {
  function inspect(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (entry.name.endsWith(".js")) {
        const script = readFileSync(path, "utf8");
        for (const forbidden of [
          "loops_test_only_do_not_send",
          "LOOPS_API_KEY",
          "ADMIN_NOTIFICATION_EMAIL",
          "app.loops.so/api/v1",
        ])
          expect(script, path).not.toContain(forbidden);
      }
    }
  }
  inspect(".next/static");
});
