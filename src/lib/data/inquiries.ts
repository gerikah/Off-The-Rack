import "server-only";
import { getSupabase } from "../supabase";
import { inquirySchema } from "../validation";
import { logDataError } from "./errors";
export async function createInquiry(input: unknown) {
  const value = inquirySchema.parse(input);
  if (value.website) throw new Error("Invalid submission.");
  const client = getSupabase();
  if (value.inquiry_type === "product") {
    const { data, error } = await client
      .from("products")
      .select("id")
      .eq("id", value.product_id!)
      .maybeSingle();
    if (error || !data) {
      if (error) logDataError("validate inquiry product", error);
      throw new Error(
        "Please choose a piece from the collection and try again.",
      );
    }
  }
  const custom = value.inquiry_type === "custom";
  const { error } = await client.from("inquiries").insert({
    customer_name: value.customer_name,
    email: value.email,
    mobile: value.mobile || null,
    inquiry_type: value.inquiry_type,
    product_id: value.inquiry_type === "product" ? value.product_id : null,
    garment_type: custom ? value.garment_type || null : null,
    preferred_size: custom ? value.preferred_size || null : null,
    design_idea: custom ? value.design_idea || null : null,
    reference_url: custom ? value.reference_url || null : null,
    message: value.message,
    status: "new",
  });
  if (error) {
    logDataError("create inquiry", error);
    throw new Error("We couldn't send your inquiry. Please try again shortly.");
  }
}
