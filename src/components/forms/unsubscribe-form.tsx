"use client";
import { useEffect, useRef, useState } from "react";
export function UnsubscribeForm() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const sending = useRef(false);
  useEffect(() => {
    const value = window.location.hash.slice(1);
    const frame = window.requestAnimationFrame(() => {
      setToken(value);
      if (value)
        window.history.replaceState(null, "", window.location.pathname);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  async function unsubscribe() {
    if (sending.current) return;
    sending.current = true;
    setState("pending");
    try {
      const response = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Please try again shortly.");
      setState("success");
      setToken("");
      setMessage(result.message);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Please try again shortly.",
      );
    } finally {
      sending.current = false;
    }
  }
  return (
    <div className="unsubscribe-panel">
      <p>Confirm below to stop receiving drop-list emails from Off The Rack.</p>
      {state !== "success" && (
        <button
          className="button button-dark"
          disabled={!/^[A-Za-z0-9_-]{43}$/.test(token) || state === "pending"}
          onClick={unsubscribe}
        >
          {state === "pending" ? "Updating…" : "Unsubscribe from the drop list"}
        </button>
      )}
      {!token && state !== "success" && (
        <p>Open the unsubscribe link in your newsletter to continue.</p>
      )}
      <p role={state === "error" ? "alert" : "status"}>{message}</p>
    </div>
  );
}
