"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { loginSchema, type ActionState } from "@/lib/admin/validation";
import { logDataError } from "@/lib/data/errors";
export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const client = createClient(await cookies());
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error)
    return {
      error: "Could not sign in. Check your email and password and try again.",
    };
  const membership = await client.rpc("otr_is_admin");
  if (membership.error || membership.data !== true) {
    if (membership.error) logDataError("verify admin login", membership.error);
    await client.auth.signOut({ scope: "local" });
    return {
      error: membership.error
        ? "Admin access is unavailable. Contact the store owner."
        : "This account does not have admin access.",
    };
  }
  revalidatePath("/admin", "layout");
  redirect("/admin");
}
export async function logoutAction(): Promise<ActionState> {
  const client = createClient(await cookies());
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) return { error: "Could not log out. Please try again." };
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}
