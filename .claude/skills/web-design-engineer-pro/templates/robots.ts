// robots.ts — Next.js 16+
// Ubicar en: src/app/robots.ts

import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // Bloquear rutas privadas/internas si las hay:
      // { userAgent: "*", disallow: ["/admin/", "/api/internal/"] },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
