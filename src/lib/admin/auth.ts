import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logDataError } from "@/lib/data/errors";
// React cache is request-scoped, never a shared cache of authorization decisions.
export const getAdminSession = cache(async () => {
  const client = createClient(await cookies());
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return { client, user: null, isAdmin: false, verificationFailed: false };
  const membership = await client.rpc("otr_is_admin");
  if (membership.error) logDataError("verify admin", membership.error);
  return {
    client,
    user,
    isAdmin: !membership.error && membership.data === true,
    verificationFailed: !!membership.error,
  };
});
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.user) redirect("/admin/login");
  if (!session.isAdmin) redirect("/admin/login?access=denied");
  return { client: session.client, user: session.user };
}
