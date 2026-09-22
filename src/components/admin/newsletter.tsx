"use client";
import { useEffect, useRef, useState } from "react";
import {
  campaignContentSchema,
  newsletterDashboardSchema,
  type NewsletterCampaign,
  type NewsletterDashboard,
} from "@/lib/newsletter/content";
import { AdminHeading, StatusBadge } from "./ui";

export function NewsletterManager({
  initial,
  configured,
  sendingEnabled,
}: {
  initial: NewsletterDashboard;
  configured: boolean;
  sendingEnabled: boolean;
}) {
  const [dashboard, setDashboard] = useState(initial);
  const [ready, setReady] = useState(configured);
  const [enabled, setEnabled] = useState(sendingEnabled);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmation, setConfirmation] = useState<"send" | "legacy" | null>(
    null,
  );
  const [agreed, setAgreed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const draftId = useRef<string | null>(null);
  const selected = dashboard.campaigns.find((item) => item.id === current);
  useEffect(() => {
    if (!confirmation) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [confirmation]);
  async function request(payload?: Record<string, unknown>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch(
        "/api/admin/newsletter",
        payload
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          : { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Please refresh and try again.");
      setDashboard(newsletterDashboardSchema.parse(result.dashboard));
      setReady(result.configured === true);
      setEnabled(result.sendingEnabled === true);
      setMessage(result.message || "Recipient counts and campaigns refreshed.");
      return true;
    } catch (caught) {
      setError(true);
      setMessage(
        caught instanceof Error ? caught.message : "Please try again shortly.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = campaignContentSchema.safeParse({ subject, body });
    if (!parsed.success) {
      setError(true);
      setMessage(parsed.error.issues[0].message);
      return;
    }
    draftId.current ||= crypto.randomUUID();
    if (
      await request({ action: "create", id: draftId.current, ...parsed.data })
    )
      setCurrent(draftId.current);
  }
  function choose(campaign: NewsletterCampaign) {
    setCurrent(campaign.id);
    setSubject(campaign.subject);
    setBody(campaign.body);
    setMessage("");
  }
  function newDraft() {
    setCurrent(null);
    setSubject("");
    setBody("");
    draftId.current = null;
    setMessage("");
  }
  function confirm(kind: "send" | "legacy") {
    setAgreed(false);
    setConfirmation(kind);
  }
  async function finishConfirmation() {
    if (!agreed || !confirmation) return;
    const succeeded = await request(
      confirmation === "send"
        ? {
            action: "start",
            id: current,
            expected_count: dashboard.eligible,
            confirmed: true,
          }
        : {
            action: "verify_legacy",
            expected_count: dashboard.legacy,
            confirmed: true,
          },
    );
    setConfirmation(null);
    // Preserve the actionable send error; refreshing here would hide it.
    if (!succeeded) return;
  }
  return (
    <>
      <AdminHeading
        title="Newsletter"
        description="A considered update for the drop list."
      >
        <button
          className="admin-button admin-button-secondary"
          disabled={pending}
          onClick={() => void request()}
        >
          Refresh counts
        </button>
      </AdminHeading>
      {!ready && (
        <p className="admin-newsletter-notice">
          Email delivery is not configured. You can prepare drafts; complete
          docs/NEWSLETTER_SETUP.md before sending.
        </p>
      )}
      {ready && !enabled && (
        <p className="admin-newsletter-notice">
          Subscriber campaigns are disabled. You can send a test to your
          verified admin email; follow the setup guide before enabling campaign
          delivery.
        </p>
      )}
      <p className="admin-newsletter-count">
        <strong>{dashboard.eligible}</strong> eligible subscribers ·{" "}
        {dashboard.legacy} existing signups awaiting consent verification.
      </p>
      {dashboard.legacy > 0 && (
        <div className="admin-newsletter-notice">
          <p>
            Existing records are preserved. Review the original signup records
            and confirm voluntary newsletter consent before including these
            addresses.
          </p>
          <button
            className="admin-button admin-button-secondary"
            disabled={pending}
            onClick={() => confirm("legacy")}
          >
            Record existing consent verification
          </button>
        </div>
      )}
      <div className="admin-newsletter-grid">
        <section className="admin-card">
          <h2>{selected ? "Campaign" : "Compose a newsletter"}</h2>
          <form className="admin-form" onSubmit={save} aria-busy={pending}>
            <fieldset className="admin-form-lock" disabled={pending}>
              <label>
                Subject *
                <input
                  value={subject}
                  readOnly={!!selected}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    draftId.current = null;
                  }}
                  required
                  minLength={3}
                  maxLength={150}
                />
              </label>
              <label>
                Message *
                <textarea
                  value={body}
                  readOnly={!!selected}
                  onChange={(event) => {
                    setBody(event.target.value);
                    draftId.current = null;
                  }}
                  required
                  minLength={20}
                  maxLength={20000}
                  rows={12}
                />
              </label>
              <p className="admin-field-help">
                Plain text with paragraph breaks. The email includes the studio
                address and a personal unsubscribe link.
              </p>
              {!selected && (
                <button className="admin-button" type="submit">
                  {pending ? "Saving…" : "Save draft"}
                </button>
              )}
            </fieldset>
          </form>
          {selected && (
            <div className="admin-newsletter-actions">
              <StatusBadge status={selected.status} />
              <p>
                {selected.sent_count} accepted by provider /{" "}
                {selected.recipient_count} recipients · {selected.skipped_count}{" "}
                opted out before sending.
              </p>
              {selected.status === "draft" && (
                <>
                  <button
                    className="admin-button admin-button-secondary"
                    disabled={pending || !ready}
                    onClick={() =>
                      void request({
                        action: "test",
                        id: selected.id,
                        test_id: crypto.randomUUID(),
                      })
                    }
                  >
                    Send test to my admin email
                  </button>
                  <button
                    className="admin-button"
                    disabled={
                      pending || !ready || !enabled || dashboard.eligible === 0
                    }
                    onClick={() => confirm("send")}
                  >
                    Review and send
                  </button>
                </>
              )}
              {selected.status === "sending" && (
                <>
                  <p>
                    Each action processes up to 25 recipients. Continue until
                    the campaign is complete. An interrupted campaign can be
                    resumed here.
                  </p>
                  <button
                    className="admin-button"
                    disabled={pending || !ready || !enabled}
                    onClick={() =>
                      void request({ action: "next", id: selected.id })
                    }
                  >
                    {pending ? "Processing batch…" : "Send next batch / resume"}
                  </button>
                </>
              )}
              {selected.status === "paused" && (
                <p className="admin-error">
                  This campaign needs reconciliation in the provider dashboard.
                  Follow docs/NEWSLETTER_SETUP.md before continuing; creating a
                  replacement may duplicate delivery.
                </p>
              )}
              <button
                className="admin-button admin-button-secondary"
                disabled={pending}
                onClick={newDraft}
              >
                New draft
              </button>
            </div>
          )}
        </section>
        <section
          className="admin-card admin-newsletter-preview"
          aria-label="Newsletter preview"
        >
          <span className="eyebrow">OFF THE RACK / DROP LIST</span>
          <h2>{subject || "Your newsletter subject"}</h2>
          <p className="admin-newsletter-body">
            {body || "Your message will appear here as you write."}
          </p>
          <hr />
          <p className="admin-field-help">
            Your configured studio mailing address and unsubscribe link are
            added to each recipient&apos;s email. Send a test to review the
            complete email.
          </p>
        </section>
      </div>
      <p
        className={error ? "admin-error" : "admin-newsletter-feedback"}
        role={error ? "alert" : "status"}
      >
        {pending ? "Processing…" : message}
      </p>
      <section className="admin-card">
        <h2>Recent campaigns</h2>
        {dashboard.campaigns.length ? (
          <ul className="admin-campaign-list">
            {dashboard.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <button
                  disabled={pending}
                  onClick={() => choose(campaign)}
                  aria-pressed={current === campaign.id}
                >
                  {campaign.subject}
                </button>
                <StatusBadge status={campaign.status} />
                <span>
                  {campaign.sent_count}/{campaign.recipient_count} accepted
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No campaigns yet. Save a draft to begin.</p>
        )}
      </section>
      {confirmation && (
        <dialog
          ref={dialog}
          className="admin-dialog"
          aria-labelledby="newsletter-confirm-title"
          onCancel={(event) => {
            if (pending) event.preventDefault();
            else setConfirmation(null);
          }}
        >
          <h2 id="newsletter-confirm-title">
            {confirmation === "send"
              ? `Send to ${dashboard.eligible} subscribers?`
              : `Verify consent for ${dashboard.legacy} existing signups?`}
          </h2>
          <p>
            {confirmation === "send"
              ? `Subject: ${selected?.subject}. Once sent, this email cannot be recalled. The first batch contains up to 25 recipients.`
              : "Only confirm after reviewing evidence that these existing subscribers voluntarily requested newsletter emails. This records your verification date and preserves original signup dates."}
          </p>
          <label className="admin-newsletter-consent">
            <input
              type="checkbox"
              checked={agreed}
              disabled={pending}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>
              {confirmation === "send"
                ? "I reviewed the subject, content, test email, and recipient count. Send this campaign."
                : "I reviewed the existing signup evidence and verified voluntary newsletter consent."}
            </span>
          </label>
          <div className="admin-form-actions">
            <button
              className="admin-button admin-button-secondary"
              disabled={pending}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              className="admin-button"
              disabled={pending || !agreed}
              onClick={() => void finishConfirmation()}
            >
              {pending ? "Processing…" : "Confirm"}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
