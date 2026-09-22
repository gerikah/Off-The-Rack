import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { Arrow } from "@/components/ui";
export const metadata: Metadata = publicMetadata(
  "Get in touch",
  "Contact Off The Rack about hand-painted clothing, custom ideas, availability and collaborations. Every conversation starts with an inquiry.",
  "/contact",
);
export default function ContactPage() {
  return (
    <section className="section-wrap contact-page">
      <div className="contact-heading">
        <span className="eyebrow">OPEN TO CONVERSATION / PHILIPPINES</span>
        <h1 className="display">
          LET’S MAKE
          <br />A CONNECTION<span className="heading-dot">.</span>
        </h1>
        <p>
          A piece caught your eye? An idea on your mind?
          <br />
          You’re in the right place.
        </p>
      </div>
      <div className="contact-options">
        <Link href="/inquiry">
          <span className="eyebrow">01 / SAY HELLO</span>
          <h2>
            General inquiries <Arrow diagonal />
          </h2>
          <p>Availability, sizing, delivery, or just a question.</p>
        </Link>
        <Link href="/inquiry?type=custom">
          <span className="eyebrow">02 / MAKE IT PERSONAL</span>
          <h2>
            Custom inquiries <Arrow diagonal />
          </h2>
          <p>Your idea, reimagined as a one-of-one piece.</p>
        </Link>
      </div>
      <div className="contact-details">
        <div>
          <span className="eyebrow">EMAIL</span>
          {brand.email ? (
            <a href={`mailto:${brand.email}`}>
              {brand.email}
              <Arrow diagonal />
            </a>
          ) : (
            <Link href="/inquiry">
              Reach us through the inquiry form <Arrow diagonal />
            </Link>
          )}
        </div>
        <div>
          <span className="eyebrow">FIND US ELSEWHERE</span>
          {brand.socials.length ? (
            brand.socials.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.name}
                <Arrow diagonal />
              </a>
            ))
          ) : (
            <p>Official social channels coming soon.</p>
          )}
        </div>
      </div>
    </section>
  );
}
