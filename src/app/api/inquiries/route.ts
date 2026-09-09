import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/validation";
import { getSupabase } from "@/lib/supabase";

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
  const client = getSupabase();
  if (!client) return NextResponse.json({ mode: "preview" });
  const { website: _website, consent, ...payload } = parsed.data;
  void _website;
  const { error } = await client.rpc("submit_inquiry", {
    payload: { ...payload, consent },
  });
  if (error)
    return NextResponse.json(
      {
        error:
          "We couldn’t send your inquiry. Please wait a minute and try again.",
      },
      { status: 503 },
    );
  return NextResponse.json({ mode: "live" }, { status: 201 });
}
