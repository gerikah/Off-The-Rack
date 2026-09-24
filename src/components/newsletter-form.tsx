"use client";
import { useEffect, useRef, useState } from "react";
import { newsletterSchema } from "@/lib/validation";
import { Arrow } from "./ui";
import type { SubmissionResult } from "@/lib/types";

export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "pending" | "live" | "error">(
    "idle",
  );
  const submitting = useRef(false);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const parsed = newsletterSchema.safeParse({
      ...Object.fromEntries(fields),
      consent: fields.get("consent") === "on",
      started_at: startedAt.current,
    });
    if (!parsed.success) {
      setState("error");
      setMessage(parsed.error.issues[0].message);
      return;
    }
    submitting.current = true;
    setState("pending");
    setMessage("JOINING THE DROP LIST...");
    let failureMessage = "COULDN'T ADD YOU TO THE LIST. Please try again.";
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json()) as SubmissionResult;
      if (!response.ok) {
        failureMessage = result.error || failureMessage;
        throw new Error("Submission failed");
      }
      setState(result.mode);
      const heading =
        result.status === "already_subscribed"
          ? "YOU'RE ALREADY ON THE LIST."
          : "YOU'RE ON THE LIST.";
      setMessage(
        result.emailStatus === "pending"
          ? `${heading} Your subscription is saved, but the email update couldn't be completed right now.`
          : `${heading} You can unsubscribe anytime.`,
      );
      if (result.mode === "live") {
        form.reset();
        startedAt.current = Date.now();
      }
    } catch {
      setState("error");
      setMessage(failureMessage);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <section id="drop-list" className="newsletter-section">
      <div>
        <span className="eyebrow">DON’T MISS YOUR ONE OF ONE.</span>
        <h2 className="display">
          JOIN THE DROP LIST<sup>↗</sup>
        </h2>
        <p>
          Be the first to know about new arrivals, custom slots, and exclusive
          drops.
        </p>
      </div>
      <div className="newsletter-form-wrap">
        <form
          onSubmit={submit}
          className="newsletter-form"
          aria-busy={state === "pending"}
        >
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            placeholder="Your email address"
            autoComplete="email"
            aria-describedby="newsletter-feedback"
            required
            maxLength={254}
            disabled={state === "pending"}
          />
          <div className="honeypot" aria-hidden="true">
            <label>
              Leave this empty
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <button type="submit" disabled={state === "pending"}>
            {state === "pending" ? "JOINING..." : "SUBSCRIBE"}
            <Arrow />
          </button>
          <label className="newsletter-consent">
            <input
              name="consent"
              type="checkbox"
              required
              disabled={state === "pending"}
            />
            <span>
              I agree to receive Off The Rack drops and custom-slot emails.
              Unsubscribe anytime.
            </span>
          </label>
        </form>
        <p
          id="newsletter-feedback"
          className={`form-feedback ${state === "error" ? "is-error" : ""}`}
          role={state === "error" ? "alert" : "status"}
          aria-live="polite"
          aria-atomic="true"
        >
          {message || "New drops and custom slots. Only the good stuff."}
        </p>
      </div>
    </section>
  );
}
