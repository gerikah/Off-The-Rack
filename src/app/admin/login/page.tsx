import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { LoginForm, LogoutButton } from "@/components/admin/auth-form";
export default async function AdminLogin() {
  const session = await getAdminSession();
  if (session.isAdmin) redirect("/admin");
  return (
    <div className="admin-login">
      <div className="admin-login-brand">
        <Image
          src="/images/star-off-the-rack-logo-favicon.webp"
          width={124}
          height={98}
          alt="Off The Rack"
        />
        <span>OFF THE RACK</span>
        <p>STUDIO WORKSPACE</p>
      </div>
      <section className="admin-login-card">
        <p className="admin-kicker">ADMIN ACCESS</p>
        <h1>{session.user ? "Access not granted" : "Welcome back."}</h1>
        {session.user ? (
          <>
            <p>
              {session.verificationFailed
                ? "Admin access is unavailable. Contact the store owner."
                : "This account does not have access to this workspace."}
            </p>
            <LogoutButton />
          </>
        ) : (
          <>
            <p>Log in to manage the rack.</p>
            <LoginForm />
          </>
        )}
        <Link href="/" className="admin-store-link">
          Back to storefront &#8599;
        </Link>
      </section>
      <p className="admin-login-footnote">
        INDEPENDENT BY DESIGN. ORGANIZED BY YOU.
      </p>
    </div>
  );
}
