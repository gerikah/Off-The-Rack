import { NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validation";
import { subscribeToNewsletter } from "@/lib/data/newsletter";
import { sendWelcomeEmail, upsertNewsletterContact } from "@/lib/email/loops";
import {
  limitPublicRequest,
  PublicRequestError,
  readPublicJson,
  validateFormTiming,
} from "@/lib/security/public-request";
export async function POST(request: Request) {
  try {
    limitPublicRequest(request, "newsletter");
    const parsed = newsletterSchema.safeParse(
      await readPublicJson(request, 2000),
    );
    if (!parsed.success || parsed.data.website)
      throw new PublicRequestError(
        "Please enter a valid email and agree to receive updates.",
      );
    validateFormTiming(parsed.data.started_at);
    const subscription = await subscribeToNewsletter(parsed.data);
    let emailStatus: "accepted" | "pending" | "unchanged" = "unchanged";
    if (subscription.sync) {
      const contact = await upsertNewsletterContact(parsed.data.email);
      emailStatus = contact === "accepted" ? "accepted" : "pending";
      if (
        contact === "accepted" &&
        subscription.status !== "already_subscribed"
      ) {
        const welcome = await sendWelcomeEmail(parsed.data.email);
        if (welcome !== "accepted") emailStatus = "pending";
      }
    }
    return NextResponse.json(
      { mode: "live", status: subscription.status, emailStatus },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PublicRequestError
            ? error.message
            : "COULDN'T ADD YOU TO THE LIST. Please try again.",
      },
      {
        status: error instanceof PublicRequestError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
