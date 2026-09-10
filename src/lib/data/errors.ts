import "server-only";
export function logDataError(operation: string, error: { code?: string }) {
  if (process.env.NODE_ENV !== "production") {
    // Never log payloads, customer details, URLs, keys or raw database messages.
    console.error("[storefront] " + operation + " failed", {
      code: error.code || "connection_error",
    });
  }
}
