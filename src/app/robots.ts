import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Public AI crawlers follow the same policy as other public crawlers.
      // These exclusions are indexing hints; Auth and RLS protect private data.
      disallow: ["/admin", "/api/", "/inquiry", "/unsubscribe"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
