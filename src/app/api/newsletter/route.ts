import { NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validation";
import { subscribeToNewsletter } from "@/lib/data/newsletter";
export async function POST(request: Request) {
  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > 2000)
      return NextResponse.json(
        { error: "Invalid subscription request." },
        { status: 413 },
      );
    input = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Please enter a valid email." },
      { status: 400 },
    );
  }
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success || parsed.data.website)
    return NextResponse.json(
      { error: "Please enter a valid email." },
      { status: 400 },
    );
  try {
    const result = await subscribeToNewsletter(parsed.data);
    return NextResponse.json(
      { mode: "live", ...result },
      { status: result.alreadySubscribed ? 200 : 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "We couldn't save your email. Please try again shortly." },
      { status: 503 },
    );
  }
}
