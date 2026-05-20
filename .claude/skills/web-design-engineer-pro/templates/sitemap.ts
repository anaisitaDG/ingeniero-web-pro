// sitemap.ts — Next.js 16+
// Ubicar en: src/app/sitemap.ts
//
// Lee el dominio de la variable NEXT_PUBLIC_SITE_URL.
// Añadir manualmente cada ruta nueva del proyecto.

import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE}/contacto`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Añadir el resto de rutas estáticas del proyecto aquí.
    // Ejemplo dinámico:
    // ...(await getBlogPosts()).map(p => ({
    //   url: `${SITE}/blog/${p.slug}`,
    //   lastModified: p.updatedAt,
    //   changeFrequency: "monthly",
    //   priority: 0.7,
    // })),
  ];
}
