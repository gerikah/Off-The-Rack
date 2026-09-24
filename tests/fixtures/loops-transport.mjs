// Test-process-only fetch interception. Never imported by application code.
// Only the synthetic key can reach the local fixture; no Loops request leaves it.
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.hostname === "app.loops.so") {
    if (
      request.headers.get("authorization") !==
      "Bearer loops_test_only_do_not_send"
    ) {
      throw new Error(
        "Refusing non-fixture Loops credentials in automated tests",
      );
    }
    return originalFetch(
      new Request("http://127.0.0.1:4318/__loops" + url.pathname, request),
    );
  }
  return originalFetch(input, init);
};
