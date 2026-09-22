import { NextResponse } from "next/server";
import { newsletterActionSchema } from "@/lib/newsletter/content";
import {
  NewsletterError,
  newsletterAdmin,
  newsletterConfiguration,
  newsletterConfigured,
  newsletterSendingEnabled,
  requireNewsletterSending,
  newsletterDashboard,
  newsletterRpc,
  sendNewsletterBatch,
  sendNewsletterTest,
} from "@/lib/newsletter/server";
import {
  PublicRequestError,
  readPublicJson,
} from "@/lib/security/public-request";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
function failure(error: unknown) {
  const known =
    error instanceof NewsletterError || error instanceof PublicRequestError;
  if (!known) console.error("newsletter_action_error", { kind: "unexpected" });
  return NextResponse.json(
    {
      error: known
        ? error.message
        : "The newsletter action could not be completed. Please refresh and try again.",
    },
    { status: known ? error.status : 503, headers },
  );
}
export async function GET() {
  try {
    const { client } = await newsletterAdmin();
    return NextResponse.json(
      {
        dashboard: await newsletterDashboard(client),
        configured: newsletterConfigured(),
        sendingEnabled: newsletterSendingEnabled(),
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { client, user } = await newsletterAdmin();
    const parsed = newsletterActionSchema.safeParse(
      await readPublicJson(request, 30000),
    );
    if (!parsed.success)
      throw new NewsletterError(parsed.error.issues[0].message);
    const value = parsed.data;
    let message = "Newsletter updated.";
    if (value.action === "create") {
      await newsletterRpc(client, "create", {
        id: value.id,
        subject: value.subject,
        body: value.body,
      });
      message =
        "Draft saved. Review the preview and send a test before confirming.";
    } else if (value.action === "verify_legacy") {
      await newsletterRpc(client, "verify_legacy", {
        confirmed: true,
        expected_count: value.expected_count,
      });
      message = "Existing signup consent verification recorded.";
    } else if (value.action === "test") {
      if (!user.email || !user.email_confirmed_at)
        throw new NewsletterError(
          "Your administrator account needs a verified email address.",
        );
      await sendNewsletterTest(client, value.id, value.test_id, user.email);
      message =
        "Test email accepted by the provider for your signed-in administrator address. Check the inbox and provider delivery log.";
    } else {
      requireNewsletterSending();
      newsletterConfiguration();
      if (value.action === "start")
        await newsletterRpc(client, "start", {
          id: value.id,
          confirmed: true,
          expected_count: value.expected_count,
        });
      await sendNewsletterBatch(client, value.id);
      message =
        "Batch processed. Review the counts and continue if recipients remain.";
    }
    return NextResponse.json(
      {
        message,
        dashboard: await newsletterDashboard(client),
        configured: newsletterConfigured(),
        sendingEnabled: newsletterSendingEnabled(),
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
