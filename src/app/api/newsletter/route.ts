import { NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validation";
import { getSupabase } from "@/lib/supabase";
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
  const client = getSupabase();
  if (!client) return NextResponse.json({ mode: "preview" });
  const { error } = await client.rpc("subscribe_to_newsletter", {
    subscriber_email: parsed.data.email,
  });
  if (error)
    return NextResponse.json(
      { error: "We couldn’t save your email. Please try again shortly." },
      { status: 503 },
    );
  return NextResponse.json({ mode: "live" }, { status: 201 });
}
