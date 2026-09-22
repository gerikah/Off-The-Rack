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
import { siteUrl, siteDescription } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OFF THE RACK — Wearable art. No repeats.",
    template: "%s — OFF THE RACK",
  },
  description: siteDescription,
  applicationName: "Off The Rack",
  icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  twitter: { card: "summary_large_image", images: ["/social-sharing.jpg"] },
  openGraph: {
    type: "website",
    siteName: "OFF THE RACK",
    images: [
      {
        url: "/social-sharing.jpg",
        width: 1200,
        height: 630,
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
