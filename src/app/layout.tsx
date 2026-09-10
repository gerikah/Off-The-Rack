import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import { SiteChrome } from "@/components/site-chrome";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { NewsletterForm } from "@/components/newsletter-form";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "OFF THE RACK — Wearable art. No repeats.",
    template: "%s — OFF THE RACK",
  },
  description:
    "One-of-one denim and hand-painted pieces made to stand apart. Discover Off The Rack, an independent fashion label from the Philippines.",
  icons: { icon: "/icon.png" },
  openGraph: {
    type: "website",
    siteName: "OFF THE RACK",
    images: [
      {
        url: "/images/feature-jacket-2.webp",
        width: 1200,
        height: 1200,
        alt: "Off The Rack hand-painted denim",
      },
    ],
  },
};
export const viewport: Viewport = { themeColor: "#0A0A0A" };
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body id="top">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteChrome
          header={<Header />}
          footer={
            <>
              <NewsletterForm />
              <Footer />
            </>
          }
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
