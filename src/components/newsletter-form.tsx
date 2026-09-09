"use client";
import { useState } from "react";
import { Arrow } from "./ui";
import type { SubmissionResult } from "@/lib/types";

export function NewsletterForm() {
  const [state, setState] = useState<
    "idle" | "pending" | "live" | "preview" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setState("pending");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fields.get("email"),
          website: fields.get("website"),
        }),
      });
      const result = (await response.json()) as SubmissionResult;
      if (!response.ok)
        throw new Error(
          result.error || "We couldn’t save your email. Please try again.",
        );
      setState(result.mode);
      setMessage(
        result.mode === "live"
          ? "Your drop-list request has been received. Thanks for being part of the next chapter."
          : "Preview mode: your email was validated, but hasn’t been subscribed. The drop list opens when the store is connected.",
      );
      if (result.mode === "live") form.reset();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
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
          New pieces, custom slots, and upcoming drops.
          <br />
          Straight to your inbox.
        </p>
      </div>
      <div className="newsletter-form-wrap">
        <form onSubmit={submit} className="newsletter-form">
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            placeholder="Your email address"
            autoComplete="email"
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
            {state === "pending" ? "Joining…" : "Subscribe"}
            <Arrow />
          </button>
        </form>
        <p
          className={`form-feedback ${state === "error" ? "is-error" : ""}`}
          role={state === "error" ? "alert" : "status"}
        >
          {message || "New drops and custom slots. Only the good stuff."}
        </p>
      </div>
    </section>
  );
}
