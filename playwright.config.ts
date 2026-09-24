import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === "true"
      ? []
      : [
          {
            command: "node tests/fixtures/backend.mjs",
            url: "http://127.0.0.1:4318/health",
            reuseExistingServer: false,
          },
          {
            command:
              process.env.PLAYWRIGHT_PRODUCTION === "true"
                ? "node --import ./tests/fixtures/loops-transport.mjs node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100"
                : "node --import ./tests/fixtures/loops-transport.mjs node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
            url: "http://127.0.0.1:3100",
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
              NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4318",
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
                "local-test-publishable-key",
              NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
              RESEND_API_KEY: "",
              LOOPS_API_KEY: "loops_test_only_do_not_send",
              LOOPS_WELCOME_EVENT_NAME: "otr_newsletter_subscribed",
              LOOPS_NEWSLETTER_MAILING_LIST_ID: "fixture-drop-list",
              LOOPS_INQUIRY_TRANSACTIONAL_ID: "fixture-inquiry-template",
              LOOPS_ADMIN_NOTIFICATION_TRANSACTIONAL_ID:
                "fixture-admin-template",
              ADMIN_NOTIFICATION_EMAIL: "admin-notifications@example.invalid",
              NEWSLETTER_SEND_ENABLED: "false",
              NEXT_PUBLIC_SITE_URL: "https://offtherack.vercel.app",
            },
          },
        ],
});
