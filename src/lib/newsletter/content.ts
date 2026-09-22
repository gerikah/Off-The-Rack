import { z } from "zod";

export const campaignContentSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Include a subject of at least 3 characters.")
    .max(150)
    .refine(
      (value) => !/[\r\n\x00-\x1f]/.test(value),
      "The subject must be a single line.",
    ),
  body: z
    .string()
    .trim()
    .min(20, "Include at least 20 characters of newsletter content.")
    .max(20000),
});
export const newsletterActionSchema = z.discriminatedUnion("action", [
  campaignContentSchema.extend({ action: z.literal("create"), id: z.uuid() }),
  z.object({ action: z.literal("test"), id: z.uuid(), test_id: z.uuid() }),
  z.object({
    action: z.literal("start"),
    id: z.uuid(),
    confirmed: z.literal(true),
    expected_count: z.number().int().min(1),
  }),
  z.object({ action: z.literal("next"), id: z.uuid() }),
  z.object({
    action: z.literal("verify_legacy"),
    confirmed: z.literal(true),
    expected_count: z.number().int().min(1),
  }),
]);

export function escapeEmailHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

export function renderNewsletter(
  content: z.infer<typeof campaignContentSchema>,
  postalAddress: string,
  unsubscribeUrl?: string,
) {
  const footer = unsubscribeUrl
    ? `You subscribed to Off The Rack's drop list. Unsubscribe: ${unsubscribeUrl}`
    : "TEST EMAIL — unsubscribe links are added to subscriber campaigns.";
  const paragraphs = content.body
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        `<p style="line-height:1.7">${escapeEmailHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return {
    text: `OFF THE RACK\n\n${content.subject}\n\n${content.body}\n\n${postalAddress}\n${footer}`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f8f7f3;color:#1c1c1a;font-family:Arial,sans-serif"><main style="max-width:600px;margin:auto;padding:32px"><p style="letter-spacing:3px;font-size:12px">OFF THE RACK / DROP LIST</p><h1 style="font-size:28px">${escapeEmailHtml(content.subject)}</h1>${paragraphs}<hr><p style="font-size:12px;line-height:1.6">${escapeEmailHtml(postalAddress)}<br>${unsubscribeUrl ? `You subscribed to Off The Rack's drop list. <a href="${escapeEmailHtml(unsubscribeUrl)}">Unsubscribe</a>` : escapeEmailHtml(footer)}</p></main></body></html>`,
  };
}

export const campaignSchema = campaignContentSchema.extend({
  id: z.uuid(),
  status: z.enum(["draft", "sending", "sent", "paused"]),
  recipient_count: z.number(),
  sent_count: z.number(),
  skipped_count: z.number(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});
export const newsletterDashboardSchema = z.object({
  eligible: z.number(),
  legacy: z.number(),
  campaigns: z.array(campaignSchema),
});
export type NewsletterDashboard = z.infer<typeof newsletterDashboardSchema>;
export type NewsletterCampaign = z.infer<typeof campaignSchema>;
