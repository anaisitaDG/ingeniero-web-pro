import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type:        "website",
    locale:      "es_ES",
    url:         siteConfig.url,
    siteName:    siteConfig.name,
    title:       `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [
      {
        url:    siteConfig.og.image,
        width:  siteConfig.og.width,
        height: siteConfig.og.height,
        alt:    siteConfig.name,
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images:      [siteConfig.og.image],
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name:        siteConfig.name,
  url:         siteConfig.url,
  description: siteConfig.description,
  sameAs:      [],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={siteConfig.locale} className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
