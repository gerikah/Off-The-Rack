import { createHash, createHmac } from "node:crypto";

// Deterministic so an interrupted batch can be retried with the exact same payload.
// Only the SHA-256 hash is persisted. Secret rotation does not erase prior hashes.
export function unsubscribeToken(subscriberId: string, secret: string) {
  if (secret.length < 43)
    throw new Error("Newsletter unsubscribe secret is not configured.");
  return createHmac("sha256", secret)
    .update(`otr-unsubscribe-v1:${subscriberId}`)
    .digest("base64url");
}
export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function validUnsubscribeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
