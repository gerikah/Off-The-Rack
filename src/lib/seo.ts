import type { Metadata } from "next";

export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://offtherack.vercel.app",
).origin;
export const siteDescription =
  "One-of-one denim and hand-painted pieces made to stand apart. Discover Off The Rack, an independent fashion label from the Philippines.";
export function publicMetadata(
  title: string,
  description: string,
  path: string,
  image = "/social-sharing.jpg",
): Metadata {
  const url = new URL(path, siteUrl).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — OFF THE RACK`,
      description,
      url,
      type: "website",
      siteName: "OFF THE RACK",
      locale: "en_PH",
      images: [
        {
          url: image,
          alt: title,
          ...(image === "/social-sharing.jpg"
            ? { width: 1200, height: 630 }
            : {}),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — OFF THE RACK`,
      description,
      images: [image],
    },
  };
}

// JSON-LD is data, never administrator HTML. Escape all HTML-significant bytes
// before inserting it as a text child of the inert application/ld+json script.
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
