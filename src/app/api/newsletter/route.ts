import { NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validation";
import { subscribeToNewsletter } from "@/lib/data/newsletter";
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
    await subscribeToNewsletter(parsed.data);
    return NextResponse.json(
      { mode: "live" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PublicRequestError
            ? error.message
            : "We couldn't save your email. Please try again shortly.",
      },
      {
        status: error instanceof PublicRequestError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
