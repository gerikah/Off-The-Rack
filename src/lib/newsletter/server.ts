import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { getAdminSession } from "@/lib/admin/auth";
import {
  campaignContentSchema,
  campaignSchema,
  newsletterDashboardSchema,
  renderNewsletter,
} from "./content";
import { hashToken, unsubscribeToken } from "./tokens";

export class NewsletterError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function newsletterConfiguration() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM;
  const replyTo = process.env.NEWSLETTER_REPLY_TO;
  const postalAddress = process.env.NEWSLETTER_POSTAL_ADDRESS;
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const url = siteUrl ? z.url().safeParse(siteUrl) : null;
  if (
    !apiKey ||
    !from ||
    !postalAddress?.trim() ||
    postalAddress.length > 1000 ||
    !secret ||
    secret.length < 43 ||
    !url?.success ||
    !siteUrl?.startsWith("https://") ||
    /[\r\n]/.test(from) ||
    !z.email().safeParse(from.match(/<([^<>]+)>$/)?.[1] || from).success ||
    (replyTo && !z.email().safeParse(replyTo).success)
  ) {
    throw new NewsletterError(
      "Email delivery is not configured. Complete docs/NEWSLETTER_SETUP.md before sending.",
      503,
    );
  }
  const origin = new URL(siteUrl).origin;
  if (new URL(siteUrl).username || new URL(siteUrl).password)
    throw new NewsletterError(
      "Use the public HTTPS storefront URL in newsletter configuration.",
      503,
    );
  return { apiKey, from, replyTo, postalAddress, secret, origin };
}
export function newsletterSendingEnabled() {
  return process.env.NEWSLETTER_SEND_ENABLED === "true";
}
export function requireNewsletterSending() {
  if (!newsletterSendingEnabled())
    throw new NewsletterError(
      "Subscriber campaigns are disabled. Complete docs/NEWSLETTER_SETUP.md before enabling campaign delivery.",
      503,
    );
}
export function newsletterConfigured() {
  try {
    newsletterConfiguration();
    return true;
  } catch {
    return false;
  }
}

export async function newsletterAdmin() {
  const session = await getAdminSession();
  if (!session.user) throw new NewsletterError("Sign in to continue.", 401);
  if (!session.isAdmin)
    throw new NewsletterError("Administrator access is required.", 403);
  return { client: session.client, user: session.user };
}

export async function newsletterRpc(
  client: SupabaseClient<Database>,
  action: string,
  payload: Json = {},
) {
  const { data, error } = await client.rpc("otr_newsletter_admin", {
    action,
    payload,
  });
  if (error) {
    // Codes only: database/provider messages may contain addresses or tokens.
    console.error("newsletter_database_error", { code: error.code });
    throw new NewsletterError(
      "Newsletter storage is unavailable. Check migration 004 and retry.",
      503,
    );
  }
  const result = z
    .object({ error: z.string().optional() })
    .passthrough()
    .safeParse(data);
  if (result.success && result.data.error) {
    const messages: Record<string, string> = {
      busy: "Another batch is processing. Wait at least 60 seconds before resuming.",
      rate_limited: "Please wait a minute before trying again.",
      count_changed:
        "The eligible recipient count changed. Refresh and confirm the updated count.",
      paused:
        "Delivery is paused because a prior batch needs reconciliation in Resend. Follow the setup guide; do not create a replacement campaign.",
      no_recipients: "There are no eligible subscribers to send to.",
      invalid_state: "This campaign changed. Refresh before continuing.",
      invalid_content:
        "Provide a valid subject and plain-text newsletter content.",
    };
    throw new NewsletterError(
      messages[result.data.error] ||
        "The newsletter action could not be completed.",
      result.data.error === "rate_limited" || result.data.error === "busy"
        ? 429
        : 409,
    );
  }
  return data;
}

export async function newsletterDashboard(client: SupabaseClient<Database>) {
  return newsletterDashboardSchema.parse(
    await newsletterRpc(client, "dashboard"),
  );
}

type Mail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
  headers?: Record<string, string>;
};
async function deliverBatch(messages: Mail[], key: string, apiKey: string) {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "x-batch-validation": "strict",
      },
      body: JSON.stringify(messages),
    });
  } catch {
    console.error("newsletter_provider_error", { kind: "network" });
    throw new NewsletterError(
      "The email provider did not confirm this batch. Wait 60 seconds, then resume this same campaign within 23 hours.",
      503,
    );
  }
  if (!response.ok) {
    console.error("newsletter_provider_error", { status: response.status });
    throw new NewsletterError(
      `Email provider returned status ${response.status}. Check the provider dashboard and configuration, then resume the same campaign within 23 hours.`,
      503,
    );
  }
  const result = z
    .object({ data: z.array(z.object({ id: z.string().min(1) })) })
    .safeParse(await response.json().catch(() => null));
  if (!result.success || result.data.data.length !== messages.length) {
    throw new NewsletterError(
      "Email provider response could not be confirmed. Resume the same campaign within 23 hours.",
      503,
    );
  }
  return result.data.data.map((item) => item.id);
}

export async function sendNewsletterTest(
  client: SupabaseClient<Database>,
  id: string,
  testId: string,
  email: string,
) {
  const config = newsletterConfiguration();
  const result = z
    .object({ campaign: campaignSchema })
    .parse(await newsletterRpc(client, "test", { id, test_id: testId }));
  const content = campaignContentSchema.parse(result.campaign);
  const mail = {
    from: config.from,
    to: [z.email().parse(email)],
    subject: `[TEST] ${content.subject}`,
    ...renderNewsletter(content, config.postalAddress),
    ...(config.replyTo ? { reply_to: config.replyTo } : {}),
  };
  await deliverBatch([mail], `otr-test/${testId}`, config.apiKey);
}

const claimSchema = z.object({
  done: z.boolean().optional(),
  batch_id: z.uuid().optional(),
  campaign: campaignSchema.optional(),
  recipients: z
    .array(z.object({ id: z.uuid(), email: z.email() }))
    .max(25)
    .optional(),
});
export async function sendNewsletterBatch(
  client: SupabaseClient<Database>,
  id: string,
) {
  requireNewsletterSending();
  const config = newsletterConfiguration();
  const claim = claimSchema.parse(await newsletterRpc(client, "claim", { id }));
  if (claim.done) return { done: true };
  if (!claim.batch_id || !claim.campaign || !claim.recipients?.length)
    throw new NewsletterError(
      "No batch is available. Refresh the campaign.",
      409,
    );
  const content = campaignContentSchema.parse(claim.campaign);
  const tokens: { id: string; hash: string }[] = [];
  const messages = claim.recipients.map((recipient) => {
    const token = unsubscribeToken(recipient.id, config.secret);
    tokens.push({ id: recipient.id, hash: hashToken(token) });
    // Fragment keeps the bearer token out of storefront request URLs/access logs.
    const unsubscribeUrl = `${config.origin}/unsubscribe#${token}`;
    const oneClickUrl = `${config.origin}/api/newsletter/unsubscribe?token=${token}`;
    return {
      from: config.from,
      to: [recipient.email],
      subject: content.subject,
      ...renderNewsletter(content, config.postalAddress, unsubscribeUrl),
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      headers: {
        "List-Unsubscribe": `<${oneClickUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });
  // Persist only hashes before delivery. Freeze an exact payload fingerprint for retries.
  await newsletterRpc(client, "prepare", {
    id,
    batch_id: claim.batch_id,
    payload_hash: hashToken(JSON.stringify(messages)),
    tokens,
  });
  const providerIds = await deliverBatch(
    messages,
    `otr-campaign/${id}/${claim.batch_id}`,
    config.apiKey,
  );
  await newsletterRpc(client, "complete", {
    id,
    batch_id: claim.batch_id,
    provider_ids: providerIds,
  });
  console.info("newsletter_batch_accepted", {
    campaign: id,
    count: messages.length,
  });
  return { done: false };
}
