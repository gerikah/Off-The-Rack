import "server-only";
import { getSupabase } from "../supabase";
import { newsletterSchema } from "../validation";
import { z } from "zod";
import { logEmailError } from "../email/loops";
import { PublicRequestError } from "../security/public-request";
export async function subscribeToNewsletter(input: unknown) {
  const value = newsletterSchema.parse(input);
  if (value.website) throw new Error("Invalid submission.");
  const { data, error } = await getSupabase().rpc("otr_subscribe_newsletter", {
    email_value: value.email,
    consent_value: value.consent,
  });
  if (error) {
    logEmailError("newsletter_supabase_error", "database");
    if (error.code === "P0001")
      throw new PublicRequestError(
        "Please wait a minute before trying again.",
        429,
      );
    throw new Error("We couldn't save your email. Please try again shortly.");
  }
  return z
    .object({
      status: z.enum(["subscribed", "already_subscribed", "reactivated"]),
      sync: z.boolean(),
    })
    .parse(data);
}
