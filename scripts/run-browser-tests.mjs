// Starts only isolated local test services and owns their complete process lifecycle.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
const production = process.argv.includes("--production");
const args = process.argv.slice(2).filter((arg) => arg !== "--production");
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4318",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-test-publishable-key",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  NEXT_PUBLIC_SITE_URL: "https://offtherack.vercel.app",
  RESEND_API_KEY: "",
  LOOPS_API_KEY: "loops_test_only_do_not_send",
  LOOPS_WELCOME_EVENT_NAME: "otr_newsletter_subscribed",
  LOOPS_NEWSLETTER_MAILING_LIST_ID: "fixture-drop-list",
  LOOPS_INQUIRY_TRANSACTIONAL_ID: "fixture-inquiry-template",
  LOOPS_ADMIN_NOTIFICATION_TRANSACTIONAL_ID: "fixture-admin-template",
  ADMIN_NOTIFICATION_EMAIL: "admin-notifications@example.invalid",
  NEWSLETTER_SEND_ENABLED: "false",
  NEXT_TELEMETRY_DISABLED: "1",
  PLAYWRIGHT_EXTERNAL_SERVER: "true",
};
const children = [];
function child(file, args) {
  const processHandle = spawn(
    process.execPath,
    ["--import", "./tests/fixtures/loops-transport.mjs", file, ...args],
    {
      env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  children.push(processHandle);
  return processHandle;
}
async function run(file, args) {
  const handle = child(file, args);
  await new Promise((resolve, reject) => {
    handle.once("error", reject);
    handle.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(file + " exited " + code)),
    );
  });
}
async function free(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          "Test port " +
            port +
            " is occupied; stop your existing test server first.",
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
async function ready(url, handle) {
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    if (handle.exitCode !== null)
      throw new Error("Test server exited before ready.");
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {}
    await delay(300);
  }
  throw new Error("Test server did not become ready.");
}
function stop() {
  for (const handle of children.reverse()) {
    if (handle.exitCode !== null || !handle.pid) continue;
    try {
      if (process.platform === "win32")
        execFileSync("taskkill", ["/PID", String(handle.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      else handle.kill("SIGTERM");
    } catch {
      handle.kill();
    }
  }
}
process.once("SIGINT", () => {
  stop();
  process.exit(130);
});
process.once("SIGTERM", () => {
  stop();
  process.exit(143);
});
try {
  await free(3100);
  await free(4318);
  if (production) await run("node_modules/next/dist/bin/next", ["build"]);
  const backend = child("tests/fixtures/backend.mjs", []);
  await ready("http://127.0.0.1:4318/health", backend);
  const app = child("node_modules/next/dist/bin/next", [
    production ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ]);
  await ready("http://127.0.0.1:3100", app);
  await run("node_modules/@playwright/test/cli.js", ["test", ...args]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stop();
}
