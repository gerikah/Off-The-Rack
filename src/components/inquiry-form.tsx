"use client";
import { ProductImageView } from "./product-image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { InquiryType, Product, SubmissionResult } from "@/lib/types";
import { formatPrice, getPrimaryImage } from "@/lib/product-utils";
import { inquirySchema } from "@/lib/validation";
import { Arrow, Button } from "./ui";
import { ProductStatus } from "./product-card";

export function InquiryForm({
  product,
  initialType,
}: {
  product?: Product;
  initialType: InquiryType;
}) {
  const [type, setType] = useState<InquiryType>(initialType);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const effectiveProduct = type === "product" ? product : undefined;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const data = new FormData(event.currentTarget);
    const values = {
      ...Object.fromEntries(data),
      inquiry_type: type,
      product_id: effectiveProduct?.id || null,
      consent: data.get("consent") === "on",
      started_at: startedAt.current,
    };
    const parsed = inquirySchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as SubmissionResult;
      if (!response.ok)
        throw new Error(
          body.error || "We couldn’t send your inquiry. Please try again.",
        );
      setResult(body);
      requestAnimationFrame(() => {
        successHeading.current?.focus();
        successHeading.current?.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="inquiry-panel">
      {result ? (
        <div className="inquiry-success" role="status">
          <span className="success-symbol" aria-hidden="true">
            ↗
          </span>
          <span className="eyebrow">THE NEXT CHAPTER STARTS HERE</span>
          <h2 ref={successHeading} tabIndex={-1} className="display">
            INQUIRY
            <br />
            SENT.
          </h2>
          <p>
            Thanks for reaching out. We&apos;ll get back to you with the next
            steps.
          </p>
          <Button href="/shop">Continue shopping</Button>
          <button className="text-link" onClick={() => setResult(null)}>
            Back to inquiry <Arrow />
          </button>
        </div>
      ) : (
        <>
          <span className="eyebrow">LET’S FIND YOUR ONE OF ONE</span>
          <h2 className="display">SEND AN INQUIRY.</h2>
          <p className="form-intro">
            Tell us what you’re interested in. We’ll confirm availability,
            payment, and delivery details with you directly.
          </p>
          <form className="inquiry-form" onSubmit={submit} aria-busy={busy}>
            <div className="form-row">
              <label>
                Full name <span>*</span>
                <input
                  name="customer_name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Your full name"
                />
              </label>
              <label>
                Email <span>*</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Mobile number
                <input
                  name="mobile"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  placeholder="+63 (optional)"
                />
              </label>
              <label>
                Inquiry type <span>*</span>
                <select
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as InquiryType)}
                  required
                >
                  <option value="product" disabled={!product}>
                    Product inquiry
                  </option>
                  <option value="custom">Custom piece</option>
                  <option value="general">General question</option>
                </select>
              </label>
            </div>
            {effectiveProduct && (
              <div className="selected-product">
                <ProductImageView
                  src={getPrimaryImage(effectiveProduct).src}
                  alt={getPrimaryImage(effectiveProduct).alt}
                  width={76}
                  height={84}
                />
                <div>
                  <span className="eyebrow">YOUR SELECTED PIECE</span>
                  <Link href={`/product/${effectiveProduct.slug}`}>
                    {effectiveProduct.name}
                  </Link>
                  <span>
                    {formatPrice(effectiveProduct.price)}
                    {effectiveProduct.size
                      ? ` / Size ${effectiveProduct.size}`
                      : ""}
                  </span>
                  <ProductStatus status={effectiveProduct.status} />
                </div>
              </div>
            )}
            {type === "product" && !product && (
              <p className="field-note">
                Know the piece? Include its name in your message, or{" "}
                <Link href="/shop">choose from the collection ↗</Link>.
              </p>
            )}
            {type === "custom" && (
              <fieldset className="custom-fields">
                <legend>YOUR CUSTOM PIECE</legend>
                <div className="form-row">
                  <label>
                    Garment type
                    <select name="garment_type" defaultValue="">
                      <option value="">Select a garment</option>
                      <option>Denim jacket</option>
                      <option>Denim pants</option>
                      <option>Top</option>
                      <option>Other / let’s discuss</option>
                    </select>
                  </label>
                  <label>
                    Preferred size
                    <input
                      name="preferred_size"
                      maxLength={40}
                      placeholder="e.g. L / oversized"
                    />
                  </label>
                </div>
                <label>
                  Design idea <span>*</span>
                  <textarea
                    name="design_idea"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={3}
                    placeholder="The artwork, mood, or story you have in mind…"
                  />
                </label>
                <label>
                  Reference URL
                  <input
                    name="reference_url"
                    type="url"
                    maxLength={1000}
                    placeholder="https:// (optional)"
                  />
                </label>
              </fieldset>
            )}
            <label>
              Message <span>*</span>
              <textarea
                name="message"
                rows={4}
                minLength={10}
                maxLength={4000}
                required
                placeholder={
                  type === "custom"
                    ? "Tell us about your timeline, garment, or anything else we should know…"
                    : "What would you like to know about this piece?"
                }
              />
            </label>
            <div className="honeypot" aria-hidden="true">
              <label>
                Leave this empty
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="consent-label">
              <input type="checkbox" name="consent" required />
              <span>
                I agree to be contacted regarding this inquiry. My details will
                only be used to respond to this request.
              </span>
            </label>
            {error && (
              <p className="form-feedback is-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" type="submit" disabled={busy}>
              {busy ? "SENDING..." : "Send inquiry"}
              <Arrow />
            </button>
            <Link
              href={product ? `/product/${product.slug}` : "/shop"}
              className="cancel-link"
            >
              Cancel / back
            </Link>
          </form>
        </>
      )}
    </div>
  );
}
