"use client";
export default function AdminErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="admin-empty">
      <h1>Could not load the workspace.</h1>
      <p>Please try again.</p>
      <button type="button" className="admin-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
