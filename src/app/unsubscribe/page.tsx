import type { Metadata } from "next";
import { UnsubscribeForm } from "@/components/unsubscribe-form";
export const metadata: Metadata = {
  title: "Unsubscribe | Off The Rack",
  description: "Manage your Off The Rack drop-list subscription.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function UnsubscribePage() {
  return (
    <main id="main-content" className="page-shell unsubscribe-page">
      <span className="eyebrow">YOUR INBOX, YOUR CALL.</span>
      <h1 className="display">THE DROP LIST.</h1>
      <UnsubscribeForm />
    </main>
  );
}
