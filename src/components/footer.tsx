import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { Arrow } from "./ui";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <p className="eyebrow">
          INDEPENDENT BY DESIGN.
          <br />
          INDIVIDUAL BY NATURE.
        </p>
        <Link href="/inquiry">
          Make it personal <Arrow diagonal />
        </Link>
      </div>
      <div className="footer-wordmark" role="img" aria-label="Off The Rack">
        OFF THE RACK
      </div>
      <div className="footer-grid">
        <div>
          <Image
            src="/images/off-the-rack-logo.webp"
            alt="Off The Rack chrome logo"
            width={150}
            height={95}
          />
          <p>Wearable art. No repeats.</p>
        </div>
        <nav aria-label="Footer navigation">
          {[
            ["Home", "/"],
            ["Shop", "/shop"],
            ["About", "/about"],
            ["Contact", "/contact"],
          ].map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="footer-links">
          <span className="eyebrow">GET IN TOUCH</span>
          <Link href="/inquiry">
            General inquiries <Arrow diagonal />
          </Link>
          <Link href="/inquiry?type=custom">
            Custom pieces <Arrow diagonal />
          </Link>
          {brand.email && <a href={`mailto:${brand.email}`}>{brand.email}</a>}
        </div>
        <div className="footer-links">
          <span className="eyebrow">FOLLOW THE NEXT CHAPTER</span>
          {brand.socials.length ? (
            brand.socials.map((social) => (
              <a
                href={social.url}
                key={social.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                {social.name}
                <Arrow diagonal />
              </a>
            ))
          ) : (
            <>
              <span className="muted">Social channels coming soon.</span>
              <a href="#drop-list">
                Join the drop list <Arrow diagonal />
              </a>
            </>
          )}
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} OFF THE RACK. ALL RIGHTS RESERVED.
        </span>
        <span>HAND PAINTED / ONE OF ONE / PHILIPPINES</span>
        <a href="#top">BACK TO TOP ↑</a>
      </div>
    </footer>
  );
}
