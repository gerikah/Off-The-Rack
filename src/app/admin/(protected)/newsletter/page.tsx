import { requireAdmin } from "@/lib/admin/auth";
import { NewsletterManager } from "@/components/admin/newsletter";
import {
  newsletterConfigured,
  newsletterSendingEnabled,
  newsletterDashboard,
} from "@/lib/newsletter/server";
export default async function NewsletterPage() {
  const { client } = await requireAdmin();
  let dashboard;
  try {
    dashboard = await newsletterDashboard(client);
  } catch {
    /* Render a setup state outside the error boundary. */
  }
  if (!dashboard)
    return (
      <>
        <div className="admin-page-heading">
          <div>
            <h1>Newsletter</h1>
            <p>Compose drop-list updates for subscribers.</p>
          </div>
        </div>
        <div className="admin-empty">
          <h2>Newsletter setup is required.</h2>
          <p>
            Apply migration 004 to the existing Supabase project, then follow
            docs/NEWSLETTER_SETUP.md and reload this page. Subscriber records
            are preserved.
          </p>
        </div>
      </>
    );
  return (
    <NewsletterManager
      initial={dashboard}
      configured={newsletterConfigured()}
      sendingEnabled={newsletterSendingEnabled()}
    />
  );
}
