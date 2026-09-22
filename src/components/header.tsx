"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./ui";

export const navigation = [
  ["Home", "/"],
  ["Shop", "/shop"],
  ["About", "/about"],
  ["Contact", "/contact"],
];
export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 30);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    panel?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      panel?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    toggle.current?.focus();
  };
  return (
    <>
      <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
        <Link href="/" className="header-logo" aria-label="Off The Rack home">
          <Image
            src="/images/star-off-the-rack-logo-favicon.webp"
            alt="Off The Rack"
            width={52}
            height={52}
            preload
          />
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-tools">
          <Link
            className="icon-button"
            href="/shop?search=1"
            aria-label="Search the collection"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
          </Link>
          <Link href="/inquiry" className="header-inquiry">
            Let’s talk <Arrow diagonal />
          </Link>
          <button
            ref={toggle}
            className="icon-button menu-toggle"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(true)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M3 8h18M3 16h18" />
            </svg>
          </button>
        </div>
      </header>
      <dialog
        id="mobile-menu"
        ref={dialog}
        className="mobile-menu"
        aria-labelledby="mobile-menu-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <div className="mobile-menu-top">
          <span className="eyebrow" id="mobile-menu-title">
            OFF THE RACK / INDEX
          </span>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {navigation.map(([label, href], i) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              aria-current={pathname === href ? "page" : undefined}
            >
              <span className="eyebrow">0{i + 1}</span>
              {label}
              <Arrow diagonal />
            </Link>
          ))}
        </nav>
        <Link
          href="/inquiry?type=custom"
          className="button button-light"
          onClick={close}
        >
          Start a custom order
          <Arrow />
        </Link>
        <p className="eyebrow">WEARABLE ART. NO REPEATS.</p>
      </dialog>
    </>
  );
}
