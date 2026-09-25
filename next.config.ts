import type { NextConfig } from "next";
const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storageOrigin = storageUrl ? new URL(storageUrl).origin : "";
const isDev = process.env.NODE_ENV === "development";
const allowLoopbackStorageImages =
  isDev &&
  !!storageUrl &&
  ["127.0.0.1", "localhost", "::1"].includes(new URL(storageUrl).hostname);
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${storageOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${storageOrigin}${isDev ? " ws: http://127.0.0.1:* http://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!isDev ? ["upgrade-insecure-requests"] : []),
].join("; ");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: { serverActions: { bodySizeLimit: "40mb" } },
  images: {
    formats: ["image/webp"],
    dangerouslyAllowLocalIP: allowLoopbackStorageImages,
    remotePatterns: storageUrl
      ? [new URL("/storage/v1/object/public/product-images/**", storageUrl)]
      : [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};
export default nextConfig;
