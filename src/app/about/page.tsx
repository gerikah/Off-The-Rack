import Image from "next/image";
import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo";
import { Arrow, Button } from "@/components/ui";

export const metadata: Metadata = publicMetadata(
  "Our story",
  "Meet Off The Rack, an independent Philippine label giving existing garments a new story through hand-painted art and thoughtful reworking.",
  "/about",
);
export default function AboutPage() {
  return (
    <div className="about-page about-textured">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="eyebrow">OFF THE RACK / OUR STORY</span>
          <h1 className="display">
            OLD DENIM.
            <br />
            NEW
            <br />
            <span className="chrome">IDENTITY.</span>
          </h1>
          <p>
            Wearable art. Hand-painted denim.
            <br />
            One piece at a time.
          </p>
          <Button href="/inquiry?type=custom" className="button-light">
            Make it personal
          </Button>
        </div>
        <div className="about-hero-image">
          <Image
            src="/images/feature-jacket-1-no-bg.webp"
            alt="Back view of Feature Jacket 1, with hand-painted red and white artwork on black denim"
            fill
            preload
            sizes="(max-width: 767px) 100vw, 55vw"
          />
          <span className="eyebrow">HAND PAINTED / ONE OF ONE</span>
        </div>
      </section>
      <section className="section-wrap manifesto">
        <span className="eyebrow">01 / WHY WE MAKE</span>
        <div>
          <h2 className="display">
            A SECOND LIFE.
            <br />
            YOUR OWN EXPRESSION.
          </h2>
          <p>
            We select denim with character and give it a new identity through
            hand-painted artwork. Each garment carries its own history. Every
            brushstroke adds something new.
          </p>
          <p>Small drops. Individual pieces. Made to be worn your way.</p>
        </div>
      </section>
      <section className="section-wrap process-section">
        <div className="section-heading">
          <span className="eyebrow">02 / THE PROCESS</span>
          <span className="eyebrow">MADE BY HAND, FROM START TO FINISH</span>
        </div>
        <h2 className="display">MADE WITH INTENTION.</h2>
        <div className="process-grid">
          {[
            [
              "Select",
              "Denim with character. A garment worth giving a second life.",
            ],
            [
              "Design",
              "An idea, shaped around the piece and the person who will wear it.",
            ],
            ["Paint", "Artwork applied by hand, one layer at a time."],
            [
              "Wear",
              "The finished piece. Personal, expressive, and one of one.",
            ],
          ].map(([title, copy], i) => (
            <div key={title}>
              <span className="eyebrow">
                0{i + 1}
                <Arrow />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
        <Button href="/shop" className="button-light">
          Find your piece
        </Button>
      </section>
    </div>
  );
}
