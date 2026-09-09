"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="section-wrap empty-state">
      <span className="eyebrow">A MOMENT OFFLINE</span>
      <h1 className="display">BACK IN A MOMENT.</h1>
      <p>We couldn’t load this page. Please try again.</p>
      <button className="button" onClick={reset}>
        Try again ↗
      </button>
    </section>
  );
}
