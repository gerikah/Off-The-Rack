"use client";

import { useRef, useState } from "react";
import { useSavedProducts } from "@/lib/saved-products";

export function BookmarkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </svg>
  );
}

export function SaveProductButton({
  id,
  name,
  compact = false,
}: {
  id: string;
  name: string;
  compact?: boolean;
}) {
  const { savedIds, toggleSaved } = useSavedProducts();
  const saved = savedIds.includes(id);
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        type="button"
        className={
          compact ? "save-product compact-save" : "save-product product-action"
        }
        aria-label={saved ? `Remove ${name} from saved pieces` : `Save ${name}`}
        aria-pressed={saved}
        title={saved ? "Remove saved piece" : "Save this piece on your device"}
        onClick={() => {
          const result = toggleSaved(id);
          setMessage(
            result.saved
              ? `${name} saved ${result.persistent ? "on this device" : "for this visit"}.`
              : `${name} removed from saved pieces.`,
          );
        }}
      >
        <BookmarkIcon />
        {!compact && <span>{saved ? "Saved piece" : "Save piece"}</span>}
      </button>
      <span className="sr-only" role="status">
        {message}
      </span>
    </>
  );
}

export function ProductActions({
  id,
  name,
  slug,
}: {
  id: string;
  name: string;
  slug: string;
}) {
  const [message, setMessage] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function share() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setManualUrl("");
    const url = new URL(
      `/product/${encodeURIComponent(slug)}`,
      window.location.origin,
    ).href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} | Off The Rack`, url });
        setMessage("Piece shared.");
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied. Ready to share.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setManualUrl(url);
        setMessage("Select and copy the link below to share this piece.");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="product-actions-wrap">
      <div
        className="product-actions"
        role="group"
        aria-label="Save or share this piece"
      >
        <SaveProductButton id={id} name={name} />
        <button
          type="button"
          className="product-action"
          disabled={busy}
          onClick={share}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8" />
          </svg>
          {busy ? "Sharing…" : "Share piece"}
        </button>
      </div>
      <p className="product-action-feedback" role="status">
        {message}
      </p>
      {manualUrl && (
        <label className="share-link-field">
          Product link
          <input
            type="url"
            value={manualUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}
