// site-config.ts
// Ubicar en: src/lib/site-config.ts
//
// Single source of truth de la marca. Importar desde cualquier
// componente con: import { siteConfig } from "@/lib/site-config";

export const siteConfig = {
  /** Identidad */
  brand: {
    name: "{{BRAND_NAME}}",
    short: "{{BRAND_SHORT}}",
    legal: "{{LEGAL_NAME}}",
    tagline: "{{TAGLINE}}",
    description: "{{ONE_LINER}}",
  },

  /** Contacto */
  contact: {
    email: "{{CONTACT_EMAIL}}",
    phone: "{{PHONE}}",
    whatsapp: "{{WHATSAPP_LINK}}",
  },

  /** Ubicación física (opcional, solo si tiene local) */
  location: {
    enabled: false,
    address: "{{STREET_ADDRESS}}",
    city: "{{CITY}}",
    region: "{{REGION}}",
    postalCode: "{{POSTAL_CODE}}",
    country: "{{COUNTRY_CODE}}",
    lat: 0,
    lng: 0,
    googleMapsUrl: "",
  },

  /** Horarios (opcional, formato Schema.org openingHours) */
  hours: [
    // "Mo-Fr 09:00-18:00",
    // "Sa 10:00-14:00",
  ] as string[],

  /** Redes sociales */
  social: {
    linkedin: "{{LINKEDIN_URL}}",
    instagram: "{{INSTAGRAM_URL}}",
    twitter: "{{TWITTER_URL}}",
    youtube: "{{YOUTUBE_URL}}",
    github: "{{GITHUB_URL}}",
  },

  /** SEO */
  seo: {
    domain: "{{WEBSITE_URL}}",
    ogImage: "/og-image.jpg",
    locale: "es_ES",
    twitterHandle: "{{TWITTER_HANDLE}}",
    keywords: [
      "{{KEYWORD_1}}",
      "{{KEYWORD_2}}",
      "{{KEYWORD_3}}",
    ],
  },

  /** Acción principal */
  cta: {
    primary: { label: "{{CTA_PRIMARY}}", href: "/contacto" },
    secondary: { label: "{{CTA_SECONDARY}}", href: "#servicios" },
  },

  /** Diseño aplicado */
  design: {
    direction: "{{DESIGN_DIRECTION}}",
    palette: "{{PALETTE_ID}}",
    fontPair: "{{FONT_PAIR_ID}}",
  },

  /** Vertical de negocio */
  vertical: "{{VERTICAL}}",

  /** Funcionalidades activas */
  features: {
    blog: false,
    newsletter: false,
    bookings: false,
    payments: false,
    chat: false,
    multiLocale: false,
  },
} as const;

export type SiteConfig = typeof siteConfig;
