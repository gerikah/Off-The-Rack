import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/validation";
import { createInquiry } from "@/lib/data/inquiries";
import { sendInquiryEmails } from "@/lib/email/loops";
import {
  limitPublicRequest,
  PublicRequestError,
  readPublicJson,
  validateFormTiming,
} from "@/lib/security/public-request";

export async function POST(request: Request) {
  let input: unknown;
  try {
    limitPublicRequest(request, "inquiry");
    input = await readPublicJson(request, 16000);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PublicRequestError
            ? error.message
            : "Please submit a valid inquiry.",
      },
      { status: error instanceof PublicRequestError ? error.status : 400 },
    );
  }
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  if (parsed.data.website)
    return NextResponse.json(
      { error: "We couldn’t accept this inquiry." },
      { status: 400 },
    );
  try {
    validateFormTiming(parsed.data.started_at);
    const inquiry = await createInquiry(parsed.data);
    const confirmation = await sendInquiryEmails(inquiry);
    return NextResponse.json(
      {
        mode: "live",
        emailStatus: confirmation === "accepted" ? "accepted" : "pending",
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof PublicRequestError
            ? error.message
            : "We couldn't send your inquiry. Please try again shortly.",
      },
      { status: error instanceof PublicRequestError ? error.status : 503 },
    );
  }
}
