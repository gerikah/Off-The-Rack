import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { siteUrl } from "../seo";
import type { EmailResult, InquiryEmail } from "./types";

const endpoint = "https://app.loops.so/api/v1";
type Operation =
  | "loops_contact_sync_error"
  | "loops_welcome_email_error"
  | "inquiry_confirmation_email_error"
  | "inquiry_admin_notification_error"
  | "newsletter_supabase_error";

// Fixed operation names/statuses only: never log provider bodies or customer data.
export function logEmailError(
  operation: Operation,
  status: number | "network" | "not_configured" | "database",
) {
  console.error(`[email] ${operation}`, { status });
}

async function loopsRequest(
  path: "/contacts/update" | "/transactional" | "/events/send",
  body: Record<string, unknown>,
  operation: Operation,
  idempotencyKey?: string,
): Promise<EmailResult> {
  const apiKey = process.env.LOOPS_API_KEY?.trim();
  if (!apiKey) {
    logEmailError(operation, "not_configured");
    return "not_configured";
  }
  try {
    const response = await fetch(endpoint + path, {
      method: path === "/contacts/update" ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      // A 409 can mean a different payload reused a key; do not claim delivery.
      logEmailError(operation, response.status);
      return "unavailable";
    }
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("success" in result) ||
      result.success !== true
    ) {
      logEmailError(operation, response.status);
      return "unavailable";
    }
    return "accepted";
  } catch {
    logEmailError(operation, "network");
    return "unavailable";
  }
}

// Call with subscribed=true only after a fresh, validated consent submission.
// Future opt-out reconciliation may call this with false; never delete contacts.
export async function upsertNewsletterContact(
  email: string,
  subscribed = true,
): Promise<EmailResult> {
  const listId = process.env.LOOPS_NEWSLETTER_MAILING_LIST_ID?.trim();
  return loopsRequest(
    "/contacts/update",
    {
      email,
      subscribed,
      source: "Off The Rack drop list",
      ...(listId ? { mailingLists: { [listId]: subscribed } } : {}),
    },
    "loops_contact_sync_error",
  );
}

async function transactional(
  templateId: string | undefined,
  email: string,
  dataVariables: Record<string, string | number>,
  operation: Operation,
): Promise<EmailResult> {
  if (!templateId?.trim()) {
    logEmailError(operation, "not_configured");
    return "not_configured";
  }
  return loopsRequest(
    "/transactional",
    {
      transactionalId: templateId.trim(),
      email,
      addToAudience: false,
      dataVariables,
    },
    operation,
    randomUUID(),
  );
}

export function sendWelcomeEmail(email: string) {
  const eventName = process.env.LOOPS_WELCOME_EVENT_NAME?.trim();
  if (!eventName) {
    logEmailError("loops_welcome_email_error", "not_configured");
    return Promise.resolve<EmailResult>("not_configured");
  }
  // A drop-list welcome is marketing: use a workflow honoring unsubscribe state.
  return loopsRequest(
    "/events/send",
    {
      email,
      eventName,
      eventProperties: { shopUrl: `${siteUrl}/shop` },
    },
    "loops_welcome_email_error",
    randomUUID(),
  );
}

export async function sendInquiryEmails(
  inquiry: InquiryEmail,
): Promise<EmailResult> {
  const variables = {
    customerName: inquiry.customerName,
    inquiryType: inquiry.inquiryType,
    requestHeading:
      inquiry.inquiryType === "custom"
        ? "CUSTOM PIECE REQUEST RECEIVED"
        : "WE GOT YOUR INQUIRY.",
    productName: inquiry.product?.name || "",
    productPrice: inquiry.product
      ? new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP",
        }).format(inquiry.product.price)
      : "",
    productUrl: inquiry.product
      ? `${siteUrl}/product/${encodeURIComponent(inquiry.product.slug)}`
      : "",
    shopUrl: `${siteUrl}/shop`,
  };
  const confirmation = transactional(
    process.env.LOOPS_INQUIRY_TRANSACTIONAL_ID,
    inquiry.email,
    variables,
    "inquiry_confirmation_email_error",
  );
  // Both values are required; customer input can never choose the internal recipient.
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  const adminTemplate =
    process.env.LOOPS_ADMIN_NOTIFICATION_TRANSACTIONAL_ID?.trim();
  if (adminEmail || adminTemplate) {
    if (adminTemplate && z.email().safeParse(adminEmail).success) {
      await transactional(
        adminTemplate,
        adminEmail!,
        {
          ...variables,
          customerEmail: inquiry.email,
          message: inquiry.message,
        },
        "inquiry_admin_notification_error",
      );
    } else logEmailError("inquiry_admin_notification_error", "not_configured");
  }
  return confirmation;
}
