import "server-only";
import { getSupabase } from "../supabase";
import { newsletterSchema } from "../validation";
import { logDataError } from "./errors";
export async function subscribeToNewsletter(input: unknown) {
  const value = newsletterSchema.parse(input);
  if (value.website) throw new Error("Invalid submission.");
  const { error } = await getSupabase()
    .from("newsletter_subscribers")
    .insert({ email: value.email, is_active: true });
  if (error?.code === "23505") return { alreadySubscribed: true };
  if (error) {
    logDataError("subscribe to newsletter", error);
    throw new Error("We couldn't save your email. Please try again shortly.");
  }
  return { alreadySubscribed: false };
}
