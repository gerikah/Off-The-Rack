import Image from "next/image";
import type { Metadata } from "next";
import { Arrow, BrandStar, Button, Marquee } from "@/components/ui";
export const metadata: Metadata = { title: "Our story" };
export default function AboutPage() {
  return (
    <div className="about-page">
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
          <BrandStar />
        </div>
        <div className="about-hero-image">
          <Image
            src="/images/feature-jacket-1.webp"
            alt="Hand-painted red and white artwork on the back of reworked black denim"
            fill
            preload
            sizes="(max-width: 767px) 100vw, 60vw"
          />
          <span className="eyebrow">
            A SECOND LIFE. AN ORIGINAL EXPRESSION.
          </span>
        </div>
      </section>
      <section className="section-wrap manifesto">
        <span className="eyebrow">01 / WHY IT EXISTS</span>
        <div>
          <h2 className="display">
            CLOTHES WITH
            <br />
            SOMETHING TO SAY.
          </h2>
          <p>
            Off The Rack began with a simple belief: an existing piece can
            become something entirely new. We select denim with character, then
            give it a new identity through hand-painted artwork.
          </p>
          <p>
            It’s personal. A little raw. Never mass-produced. We’re here for the
            people who see clothing as an extension of themselves.
          </p>
        </div>
      </section>
      <div className="about-wide-image">
        <Image
          src="/images/blue-cybersigilisim-denim-hoodie-jacket.webp"
          alt="Front and back views of a hand-painted cobalt blue cybersigil denim hoodie"
          fill
          sizes="100vw"
        />
        <span className="eyebrow">02 / HAND PAINTED. EVERY SINGLE TIME.</span>
      </div>
      <section className="section-wrap philosophy">
        <div>
          <span className="eyebrow">03 / ONE OF ONE</span>
          <h2 className="display">
            THE IMPERFECTIONS
            <br />
            ARE THE POINT.
          </h2>
        </div>
        <div>
          <BrandStar />
          <p>
            A brushstroke that can’t be repeated. Denim that carries its own
            history. Every variation makes the piece what it is: yours, and
            yours alone.
          </p>
          <p>Small drops. Individual pieces. No repeats.</p>
        </div>
      </section>
      <Marquee reverse />
      <section className="section-wrap process-section">
        <div className="section-heading">
          <span className="eyebrow">04 / THE PROCESS</span>
          <span className="eyebrow">FROM AN IDEA TO SOMETHING YOU WEAR</span>
        </div>
        <h2 className="display">MADE WITH INTENTION.</h2>
        <div className="process-grid">
          {[
            [
              "Idea",
              "It starts with a reference, a feeling, or a story you want to tell.",
            ],
            [
              "Design",
              "We find the garment and map the artwork to its shape and character.",
            ],
            [
              "Hand painting",
              "Layer by layer, the idea takes shape directly on the fabric.",
            ],
            [
              "Finished piece",
              "The final details bring it together. One garment. A new identity.",
            ],
          ].map(([title, copy], i) => (
            <div key={title}>
              <span className="eyebrow">
                0{i + 1} <Arrow />
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
        <Button href="/inquiry?type=custom">Let’s make your piece</Button>
      </section>
    </div>
  );
}
