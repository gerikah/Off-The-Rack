import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/validation";
import { createInquiry } from "@/lib/data/inquiries";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 16000)
    return NextResponse.json(
      { error: "Please shorten your inquiry." },
      { status: 413 },
    );
  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > 16000)
      return NextResponse.json(
        { error: "Please shorten your inquiry." },
        { status: 413 },
      );
    input = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Please submit a valid inquiry." },
      { status: 400 },
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
    await createInquiry(parsed.data);
    return NextResponse.json({ mode: "live" }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "We couldn't send your inquiry. Please try again shortly." },
      { status: 503 },
    );
  }
}
