import Image from "next/image";
import Link from "next/link";
import { getProducts } from "@/lib/products";
import {
  Arrow,
  BrandStar,
  Button,
  Marquee,
  SectionHeading,
} from "@/components/ui";
import { ProductCard } from "@/components/product-card";

export const revalidate = 60;
export default async function HomePage() {
  const products = await getProducts();
  const arrivals = products.filter((p) => p.featured).slice(0, 3);
  const bestsellers = products.filter((p) => p.bestseller).slice(0, 5);
  return (
    <>
      <section className="hero">
        <div className="hero-topline">
          <span>INDEPENDENT CLOTHING LABEL</span>
          <span>HAND PAINTED IN THE PHILIPPINES ↗</span>
        </div>
        <div className="hero-photo">
          <Image
            src="/images/feature-jacket-2.webp"
            alt="Model wearing a black and crimson hand-painted spiderweb denim hoodie, back view"
            fill
            preload
            sizes="(max-width: 767px) 100vw, 65vw"
          />
        </div>
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow">
            <span className="tiny-cross">+</span> SELECTED. REWORKED.
            REIMAGINED.
          </div>
          <h1>
            WEARABLE <br />
            <span className="chrome">ART.</span>
            <br />
            NO REPEATS<span className="hero-period">.</span>
          </h1>
          <p>
            One-of-one denim and hand-painted pieces.
            <br />
            Made by hand. Made to stand apart.
          </p>
          <div className="hero-actions">
            <Button href="/shop" className="button-light">
              Shop collection
            </Button>
            <Link className="text-link" href="/archive">
              View archive <Arrow diagonal />
            </Link>
          </div>
        </div>
        <BrandStar className="hero-star" />
        <div className="hero-photo-caption">
          <span className="eyebrow">STUDY 01 — THE REWORK</span>
          <span>
            Every piece has a past.
            <br />
            Give it a new story.
          </span>
        </div>
        <div className="hero-bottom">
          <span>CURATED DENIM / CUSTOM PIECES</span>
          <span>1 OF 1. ALWAYS.</span>
          <a href="#new-arrivals">SCROLL TO DISCOVER ↓</a>
        </div>
      </section>
      <Marquee />
      <section id="new-arrivals" className="section-wrap arrivals-section">
        <SectionHeading index="01" label="FRESH OFF THE RACK">
          <span className="eyebrow">SMALL DROPS. NO RESTOCKS.</span>
        </SectionHeading>
        <div className="arrivals-layout">
          <div className="arrivals-intro">
            <h2 className="display">
              NEW
              <br />
              ARRIVALS<span className="heading-dot">.</span>
            </h2>
            <p>
              Fresh pieces.
              <br />
              Hand-picked. One of one.
            </p>
            <Link className="text-link" href="/shop">
              View all pieces <Arrow diagonal />
            </Link>
            <BrandStar />
          </div>
          <div className="arrival-products">
            {arrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
      <section className="brand-story">
        <Image
          className="story-background"
          src="/images/7.webp"
          alt="Three views of a black denim jacket with hand-painted red and white artwork"
          fill
          sizes="100vw"
        />
        <div className="story-top">
          <span className="eyebrow">02 / ABOUT THE BRAND</span>
          <Image
            src="/images/off-the-rack-logo.webp"
            alt="Off The Rack"
            width={190}
            height={120}
          />
        </div>
        <div className="story-copy">
          <h2 className="display">
            MORE THAN
            <br />
            JUST DENIM.
          </h2>
          <p>
            Selected denim. A fresh perspective. We turn existing pieces into
            something personal, expressive, and entirely their own.
          </p>
          <Link href="/about" className="text-link">
            Our story <Arrow diagonal />
          </Link>
        </div>
        <div className="story-facts">
          {[
            "ONE OF ONE",
            "HAND PAINTED",
            "LIMITED PIECES",
            "MADE TO STAND OUT",
          ].map((fact, i) => (
            <span key={fact}>
              <small>0{i + 1}</small>
              {fact}
            </span>
          ))}
        </div>
      </section>
      <Marquee reverse />
      <section className="section-wrap best-section">
        <SectionHeading index="03" label="THE CROWD FAVORITES">
          <Link href="/shop" className="text-link">
            Explore the collection <Arrow diagonal />
          </Link>
        </SectionHeading>
        <div className="bestseller-grid">
          <div className="bestseller-intro">
            <span className="eyebrow">GOOD PIECES FIND THEIR PEOPLE.</span>
            <h2 className="display">
              BEST
              <br />
              SELLERS<span className="heading-dot">.</span>
            </h2>
            <p>
              The pieces you keep coming back to.
              <br />
              Each one, still the only one.
            </p>
            <span className="outline-star" aria-hidden="true">
              ✳
            </span>
          </div>
          {bestsellers.map((product, i) => (
            <ProductCard
              product={product}
              key={product.id}
              className={`best-card best-card-${i}`}
            />
          ))}
          <Link href="/inquiry?type=custom" className="custom-tile">
            <Image
              src="/images/background.webp"
              alt=""
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
            />
            <div className="custom-content">
              <span className="eyebrow">YOUR IDEA. OUR CANVAS.</span>
              <BrandStar />
              <h3 className="display">
                HAVE A DESIGN
                <br />
                IN MIND?
              </h3>
              <p>Turn an idea into a one-of-one piece made for you.</p>
              <span className="text-link">
                Start a custom order <Arrow diagonal />
              </span>
            </div>
          </Link>
        </div>
      </section>
    </>
  );
}
